"""
AI parsing pipeline for statement files.
Replaces process_statement_stub in service.py.
"""

from __future__ import annotations

import asyncio
import contextlib
import csv
import hashlib
import json
import re
import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)

DATE_PATTERN = re.compile(r"\b\d{1,2}/\d{1,2}(?:/\d{2,4})?\b")
AMOUNT_PATTERN = re.compile(r"\$[\d,]+\.\d{2}|\b-?\d{1,3}(?:,\d{3})*\.\d{2}\b")


def is_transaction_page(text: str) -> bool:
    """Heuristic: page has a date pattern within ~300 chars of a dollar amount."""
    dates = list(DATE_PATTERN.finditer(text))
    amounts = list(AMOUNT_PATTERN.finditer(text))
    if not dates or not amounts:
        return False
    for d in dates:
        for a in amounts:
            if abs(d.start() - a.start()) < 300:
                return True
    return False


def extract_pdf_pages(file_path: Path) -> list[dict[str, object]]:
    """Extract rows from transaction pages only."""
    import pdfplumber

    rows: list[dict[str, object]] = []
    with pdfplumber.open(file_path) as pdf:
        total_pages = len(pdf.pages)
        transaction_pages: list[int] = []
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            if is_transaction_page(text):
                transaction_pages.append(i)

        logger.info(
            "pdf_page_classification",
            file=file_path.name,
            total_pages=total_pages,
            transaction_pages=transaction_pages,
            skipped_pages=total_pages - len(transaction_pages),
        )

        if not transaction_pages:
            logger.warning("pdf_no_transaction_pages", file=file_path.name)
            raise ValueError("unreadable_pdf")

        for page_idx in transaction_pages:
            page = pdf.pages[page_idx]
            tables = page.extract_tables()
            if tables:
                before = len(rows)
                for table in tables:
                    for row in table:
                        if row and any(cell for cell in row):
                            rows.append(
                                {"_source": "table", "_cells": [c or "" for c in row]}
                            )
                logger.debug(
                    "pdf_table_extraction",
                    page=page_idx,
                    rows_added=len(rows) - before,
                )
            else:
                text = page.extract_text() or ""
                before = len(rows)
                for line in text.split("\n"):
                    line = line.strip()
                    if line:
                        rows.append({"_source": "text", "_line": line})
                logger.debug(
                    "pdf_text_extraction",
                    page=page_idx,
                    rows_added=len(rows) - before,
                )

    logger.info("pdf_extraction_complete", file=file_path.name, total_rows=len(rows))
    return rows


def compute_column_fingerprint(headers: list[str]) -> str:
    normalized = sorted(h.strip().lower() for h in headers)
    return hashlib.sha256(",".join(normalized).encode()).hexdigest()


def extract_csv_rows(
    file_path: Path,
) -> tuple[list[dict[str, object]], str, list[str]]:
    """Returns (rows, fingerprint, headers)."""
    rows: list[dict[str, object]] = []
    with open(file_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = list(reader.fieldnames or [])
        fingerprint = compute_column_fingerprint(headers)
        for row in reader:
            rows.append(dict(row))
    return rows, fingerprint, headers


SYSTEM_PROMPT = """You are a financial transaction parser. Extract structured transaction data from raw statement rows.

Rules:
- Normalize merchant names (e.g., "SQ *COFFEE BAR #1234" → "Coffee Bar")
- Assign categories from the provided list only
- Sign convention: negative amount = expense/charge, positive = credit/payment/refund
- Skip: section headers, summary rows, balance rows, beginning/ending balance rows
- For multi-cardholder statements: include all transactions regardless of cardholder
- Date output must be ISO 8601 (YYYY-MM-DD)
- transaction_type must be one of: charge, payment, credit, refund
- confidence_per_field: object with keys date, amount, merchant, category — values 0.0 to 1.0

Respond with valid JSON only."""

USER_PROMPT_TEMPLATE = """Statement metadata:
- Issuer/card: {card_info}
- File format: {file_format}

Available categories:
{category_list}

Raw rows to parse:
{raw_rows}

Respond with this exact JSON structure:
{{
  "transactions": [
    {{
      "date_iso": "YYYY-MM-DD",
      "amount": -12.34,
      "merchant_clean": "Clean Name",
      "merchant_raw": "RAW DESCRIPTION AS SEEN",
      "transaction_type": "charge|payment|credit|refund",
      "category": "Category Name or null",
      "confidence_per_field": {{"date": 0.99, "amount": 0.99, "merchant": 0.85, "category": 0.80}},
      "notes": "optional note or null"
    }}
  ],
  "statement_total_observed": 1234.56,
  "statement_period": {{"start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}}
}}"""


async def normalize_with_ai(
    rows: list[dict[str, object]],
    card_info: str,
    file_format: str,
    categories: list[str],
    model: str = "gpt-4o-mini",
) -> tuple[dict[str, object], int, int]:
    """Returns (parsed_result, input_tokens, output_tokens).

    Calls the OpenAI Chat Completions API with JSON mode enabled so the
    response is always valid JSON — no markdown fence stripping needed.
    Token counts come from response.usage and are used for cost telemetry.
    """
    import openai

    from app.core.config import settings

    client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    category_list_str = "\n".join(f"- {c}" for c in categories)
    raw_rows_str = json.dumps(rows, indent=2)

    user_content = USER_PROMPT_TEMPLATE.format(
        card_info=card_info,
        file_format=file_format,
        category_list=category_list_str,
        raw_rows=raw_rows_str,
    )

    logger.info(
        "ai_call_start",
        model=model,
        row_count=len(rows),
        category_count=len(categories),
        categories_empty=len(categories) == 0,
    )
    logger.debug(
        "ai_prompt_categories",
        category_count=len(categories),
        category_list_str=category_list_str
        or "(empty — no categories found for household)",
    )
    logger.debug("ai_prompt_user_content", content=user_content)

    response = await client.chat.completions.create(
        model=model,
        max_completion_tokens=16384,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ],
    )

    input_tokens: int = response.usage.prompt_tokens if response.usage else 0
    output_tokens: int = response.usage.completion_tokens if response.usage else 0
    finish_reason = response.choices[0].finish_reason

    content = response.choices[0].message.content or "{}"
    result: dict[str, object] = json.loads(content)
    tx_count = (
        len(result.get("transactions", []))
        if isinstance(result.get("transactions"), list)
        else 0
    )  # type: ignore[arg-type]

    logger.info(
        "ai_call_complete",
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        transactions_returned=tx_count,
        finish_reason=finish_reason,
    )
    if finish_reason == "length":
        logger.warning(
            "ai_response_truncated",
            model=model,
            output_tokens=output_tokens,
            row_count=len(rows),
            hint="increase max_completion_tokens or reduce chunk_size",
        )
    logger.debug("ai_response_raw", content=content)

    return result, input_tokens, output_tokens


async def process_statement(statement_id: uuid.UUID) -> None:
    """Main pipeline — replaces process_statement_stub."""
    from sqlalchemy import or_, select

    from app.core.config import settings
    from app.core.database import AsyncSessionLocal
    from app.modules.categories.models import Category, CategoryRule
    from app.modules.categories.service import apply_rules
    from app.modules.statements.models import (
        FailureReason,
        FileFormat,
        IssuerSchema,
        Statement,
        StatementStatus,
    )
    from app.modules.transactions.models import Transaction, TransactionType

    log = logger.bind(statement_id=str(statement_id))
    log.info("pipeline_start")

    async with AsyncSessionLocal() as session:
        statement = await session.get(Statement, statement_id)
        if statement is None:
            log.warning("pipeline_statement_not_found")
            return
        statement.status = StatementStatus.parsing
        await session.commit()
        log.info(
            "pipeline_status_parsing",
            file=statement.file_original_name,
            mime=statement.file_mime,
        )

    try:
        async with AsyncSessionLocal() as session:
            statement = await session.get(Statement, statement_id)
            if statement is None:
                return

            file_path = Path(statement.file_storage_path)

            card_info = "Unknown"
            if statement.card_id:
                from app.modules.cards.models import Card

                card = await session.get(Card, statement.card_id)
                if card:
                    card_info = f"{card.issuer} card ending {card.last4}"
            elif statement.bank_account_id:
                from app.modules.bank_accounts.models import BankAccount

                acct = await session.get(BankAccount, statement.bank_account_id)
                if acct:
                    card_info = f"{acct.institution} bank account"

            result = await session.execute(
                select(Category)
                .where(
                    or_(
                        Category.household_id == statement.household_id,
                        Category.household_id.is_(None),
                    )
                )
                .order_by(Category.parent_id.nulls_first(), Category.name)
            )
            categories = list(result.scalars().all())
            category_names = [c.name for c in categories]
            log.info(
                "pipeline_categories_loaded",
                household_id=str(statement.household_id),
                category_count=len(category_names),
                category_names=category_names,
            )

            file_format = (
                FileFormat.pdf
                if statement.file_mime == "application/pdf"
                else FileFormat.csv
            )

            rows: list[dict[str, object]]
            if file_format == FileFormat.pdf:
                try:
                    rows = await asyncio.to_thread(extract_pdf_pages, file_path)
                except ValueError as e:
                    if "unreadable_pdf" in str(e):
                        log.warning("pipeline_unreadable_pdf", file=file_path.name)
                        statement.status = StatementStatus.failed
                        statement.failure_reason = FailureReason.unreadable_pdf
                        await session.commit()
                        return
                    raise
            else:
                rows, fingerprint, _headers = await asyncio.to_thread(
                    extract_csv_rows, file_path
                )
                log.info(
                    "csv_extracted", row_count=len(rows), fingerprint=fingerprint[:12]
                )
                schema_result = await session.execute(
                    select(IssuerSchema).where(
                        IssuerSchema.column_fingerprint == fingerprint
                    )
                )
                cached_schema = schema_result.scalar_one_or_none()
                if cached_schema and cached_schema.column_mapping:
                    mapping = cached_schema.column_mapping
                    rows = [
                        {mapping.get(k, k): v for k, v in row.items()} for row in rows
                    ]
                    statement.issuer_schema_id = cached_schema.id
                    await session.flush()
                    log.info(
                        "csv_schema_cache_hit", issuer_schema_id=str(cached_schema.id)
                    )
                else:
                    log.info("csv_schema_cache_miss", fingerprint=fingerprint[:12])

            log.info("pipeline_status_categorizing", raw_row_count=len(rows))
            statement.status = StatementStatus.categorizing
            await session.commit()

        # AI stage — outside session to avoid long-held connections
        parsed: dict[str, object]
        ai_cost_cents = 0

        if not settings.OPENAI_API_KEY:
            log.warning("pipeline_mock_mode", reason="OPENAI_API_KEY not set")
            parsed = _mock_parse(rows)
        else:
            all_transactions: list[dict[str, object]] = []
            total_input_tokens = 0
            total_output_tokens = 0
            chunk_size = 100

            statement_total_observed: object = None
            statement_period: object = None

            total_chunks = max(1, (len(rows) + chunk_size - 1) // chunk_size)
            log.info(
                "ai_chunking",
                total_rows=len(rows),
                chunk_size=chunk_size,
                total_chunks=total_chunks,
            )

            for i in range(0, max(len(rows), 1), chunk_size):
                chunk = rows[i : i + chunk_size]
                chunk_num = i // chunk_size + 1
                log.debug(
                    "ai_chunk_start",
                    chunk=chunk_num,
                    of=total_chunks,
                    rows_in_chunk=len(chunk),
                )
                chunk_result, inp, out = await normalize_with_ai(
                    rows=chunk,
                    card_info=card_info,
                    file_format=str(file_format),
                    categories=category_names,
                    model=settings.AI_MODEL,
                )
                tx_list = chunk_result.get("transactions", [])
                if isinstance(tx_list, list):
                    for item in tx_list:
                        if isinstance(item, dict):
                            all_transactions.append(item)
                total_input_tokens += inp
                total_output_tokens += out
                log.debug(
                    "ai_chunk_done",
                    chunk=chunk_num,
                    transactions_so_far=len(all_transactions),
                )
                if statement_total_observed is None:
                    statement_total_observed = chunk_result.get(
                        "statement_total_observed"
                    )
                if statement_period is None:
                    statement_period = chunk_result.get("statement_period")

            parsed = {
                "transactions": all_transactions,
                "statement_total_observed": statement_total_observed,
                "statement_period": statement_period,
            }
            # Cost telemetry: gpt-4o-mini ~$0.15/1M input, $0.60/1M output
            ai_cost_cents = int(
                (total_input_tokens * 0.15 + total_output_tokens * 0.60)
                / 1_000_000
                * 100
            )
            log.info(
                "ai_stage_complete",
                total_input_tokens=total_input_tokens,
                total_output_tokens=total_output_tokens,
                transactions_parsed=len(all_transactions),
                ai_cost_cents=ai_cost_cents,
                statement_period=statement_period,
                statement_total_observed=statement_total_observed,
            )

        async with AsyncSessionLocal() as session:
            statement = await session.get(Statement, statement_id)
            if statement is None:
                return

            if settings.OPENAI_API_KEY:
                statement.ai_cost_cents = ai_cost_cents

            period = parsed.get("statement_period") or {}
            if isinstance(period, dict):
                if period.get("start") and not statement.period_start:
                    with contextlib.suppress(ValueError):
                        statement.period_start = date.fromisoformat(
                            str(period["start"])
                        )
                if period.get("end") and not statement.period_end:
                    with contextlib.suppress(ValueError):
                        statement.period_end = date.fromisoformat(str(period["end"]))

            ai_transactions = parsed.get("transactions", [])
            transaction_objects: list[Transaction] = []
            has_low_confidence = False

            if isinstance(ai_transactions, list):
                # Reload rules and categories in this session
                cat_result = await session.execute(
                    select(Category).where(
                        or_(
                            Category.household_id == statement.household_id,
                            Category.household_id.is_(None),
                        )
                    )
                )
                session_categories = list(cat_result.scalars().all())
                session_category_map = {c.name.lower(): c for c in session_categories}

                rules_result = await session.execute(
                    select(CategoryRule).where(
                        CategoryRule.household_id == statement.household_id
                    )
                )
                session_rules = list(rules_result.scalars().all())

                for tx_data in ai_transactions:
                    if not isinstance(tx_data, dict):
                        continue
                    confidence = tx_data.get("confidence_per_field", {})
                    if not isinstance(confidence, dict):
                        confidence = {}
                    min_confidence = min(
                        float(confidence.get("date", 1.0)),
                        float(confidence.get("amount", 1.0)),
                        float(confidence.get("merchant", 1.0)),
                        float(confidence.get("category", 1.0)),
                    )
                    is_low = min_confidence < settings.CONFIDENCE_THRESHOLD
                    if is_low:
                        has_low_confidence = True

                    cat_name = tx_data.get("category")
                    category_id: uuid.UUID | None = None
                    if cat_name and isinstance(cat_name, str):
                        matched_cat = session_category_map.get(cat_name.lower())
                        if matched_cat:
                            category_id = matched_cat.id

                    merchant_clean = str(tx_data.get("merchant_clean", ""))
                    matched_rule = apply_rules(session_rules, merchant_clean)
                    if matched_rule:
                        category_id = matched_rule.category_id
                        matched_rule.hit_count += 1
                        matched_rule.last_applied_at = datetime.now(UTC)

                    try:
                        amount = Decimal(str(tx_data.get("amount", 0)))
                    except Exception:
                        amount = Decimal("0")

                    try:
                        tx_date = date.fromisoformat(str(tx_data.get("date_iso", "")))
                    except ValueError:
                        tx_date = statement.period_end or date.today()

                    tx_type_str = str(tx_data.get("transaction_type", "charge"))
                    try:
                        tx_type = TransactionType(tx_type_str)
                    except ValueError:
                        tx_type = TransactionType.charge

                    tx = Transaction(
                        statement_id=statement.id,
                        household_id=statement.household_id,
                        card_id=statement.card_id,
                        bank_account_id=statement.bank_account_id,
                        date=tx_date,
                        amount=amount,
                        merchant_clean=merchant_clean
                        or str(tx_data.get("merchant_raw", "Unknown")),
                        merchant_raw=str(tx_data.get("merchant_raw", "")),
                        transaction_type=tx_type,
                        category_id=category_id,
                        confidence_date=float(confidence["date"])
                        if "date" in confidence
                        else None,
                        confidence_amount=float(confidence["amount"])
                        if "amount" in confidence
                        else None,
                        confidence_merchant=float(confidence["merchant"])
                        if "merchant" in confidence
                        else None,
                        confidence_category=float(confidence["category"])
                        if "category" in confidence
                        else None,
                        is_low_confidence=is_low,
                        notes=str(tx_data["notes"])
                        if tx_data.get("notes") is not None
                        else None,
                    )
                    transaction_objects.append(tx)

            session.add_all(transaction_objects)

            low_confidence_count = sum(
                1 for t in transaction_objects if t.is_low_confidence
            )
            rule_applied_count = sum(
                1 for t in transaction_objects if t.category_id is not None
            )
            final_status = (
                StatementStatus.needs_review
                if has_low_confidence
                else StatementStatus.ready
            )
            statement.status = final_status
            statement.processed_at = datetime.now(UTC)
            await session.commit()

            log.info(
                "pipeline_complete",
                final_status=str(final_status),
                transactions_written=len(transaction_objects),
                low_confidence_count=low_confidence_count,
                rule_applied_count=rule_applied_count,
            )

    except Exception as exc:
        log.exception("pipeline_error", error=str(exc))
        async with AsyncSessionLocal() as session:
            statement = await session.get(Statement, statement_id)
            if statement:
                statement.status = StatementStatus.failed
                statement.failure_reason = FailureReason.parsing_error
                await session.commit()
        raise


def _mock_parse(rows: list[dict[str, object]]) -> dict[str, object]:
    """Fallback mock when OPENAI_API_KEY is not set."""
    return {
        "transactions": [],
        "statement_total_observed": None,
        "statement_period": None,
    }

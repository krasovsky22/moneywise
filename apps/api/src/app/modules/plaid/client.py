from __future__ import annotations

from plaid import ApiClient, Configuration, Environment
from plaid.api import plaid_api
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.country_code import CountryCode
from plaid.model.institutions_get_by_id_request import InstitutionsGetByIdRequest
from plaid.model.item_public_token_exchange_request import (
    ItemPublicTokenExchangeRequest,
)
from plaid.model.item_remove_request import ItemRemoveRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_update import LinkTokenCreateRequestUpdate
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.transactions_sync_request import TransactionsSyncRequest

from app.core.config import settings

_ENV_MAP = {
    "sandbox": Environment.Sandbox,
    "production": Environment.Production,
}


def _make_client() -> plaid_api.PlaidApi:
    host = _ENV_MAP.get(settings.PLAID_ENV.lower(), Environment.Sandbox)
    configuration = Configuration(
        host=host,
        api_key={"clientId": settings.PLAID_CLIENT_ID, "secret": settings.PLAID_SECRET},
    )
    api_client = ApiClient(configuration)
    return plaid_api.PlaidApi(api_client)


def create_link_token(
    user_id: str,
    household_id: str,
    access_token: str | None = None,
) -> str:
    client = _make_client()
    user = LinkTokenCreateRequestUser(client_user_id=user_id)

    if access_token is not None:
        request = LinkTokenCreateRequest(
            client_name="MoneyWise",
            language="en",
            country_codes=[CountryCode("US")],
            user=user,
            access_token=access_token,
            update=LinkTokenCreateRequestUpdate(reauthorization_enabled=True),
        )
    else:
        request = LinkTokenCreateRequest(
            client_name="MoneyWise",
            language="en",
            country_codes=[CountryCode("US")],
            user=user,
            products=[Products("transactions")],
        )

    response = client.link_token_create(request)
    return str(response["link_token"])


def exchange_public_token(public_token: str) -> tuple[str, str]:
    client = _make_client()
    request = ItemPublicTokenExchangeRequest(public_token=public_token)
    response = client.item_public_token_exchange(request)
    return str(response["access_token"]), str(response["item_id"])


def get_accounts(access_token: str) -> list[dict]:
    client = _make_client()
    request = AccountsGetRequest(access_token=access_token)
    response = client.accounts_get(request)
    accounts = response["accounts"]
    result: list[dict] = []
    for acct in accounts:
        balances = acct.get("balances", {})
        result.append(
            {
                "account_id": acct.get("account_id", ""),
                "name": acct.get("name", ""),
                "official_name": acct.get("official_name"),
                "mask": acct.get("mask"),
                "type": str(acct.get("type", "other")),
                "subtype": str(acct.get("subtype")) if acct.get("subtype") else None,
                "current_balance": balances.get("current"),
                "available_balance": balances.get("available"),
                "credit_limit": balances.get("limit"),
                "currency_code": balances.get("iso_currency_code") or "USD",
            }
        )
    return result


def sync_transactions(access_token: str, cursor: str | None) -> dict:
    client = _make_client()
    kwargs: dict = {"access_token": access_token}
    if cursor:
        kwargs["cursor"] = cursor

    request = TransactionsSyncRequest(**kwargs)
    response = client.transactions_sync(request)

    def _tx_to_dict(tx) -> dict:  # type: ignore[no-untyped-def]
        pfc = tx.get("personal_finance_category")
        pfc_primary = None
        pfc_dict = None
        if pfc is not None:
            pfc_primary = pfc.get("primary")
            pfc_dict = {
                "primary": pfc.get("primary"),
                "detailed": pfc.get("detailed"),
                "confidence_level": str(pfc.get("confidence_level", "")),
            }

        counterparties = []
        for cp in tx.get("counterparties") or []:
            counterparties.append({
                "name": cp.get("name"),
                "type": str(cp.get("type", "")),
                "logo_url": cp.get("logo_url"),
                "website": cp.get("website"),
                "entity_id": cp.get("entity_id"),
                "confidence_level": str(cp.get("confidence_level", "")),
            })

        return {
            "transaction_id": tx.get("transaction_id", ""),
            "account_id": tx.get("account_id", ""),
            "name": tx.get("name", ""),
            "merchant_name": tx.get("merchant_name"),
            "merchant_entity_id": tx.get("merchant_entity_id"),
            "amount": tx.get("amount", 0),
            "date": tx.get("date"),
            "authorized_date": tx.get("authorized_date"),
            "pending": tx.get("pending", False),
            "transaction_type": str(tx.get("transaction_type", "")),
            "payment_channel": (
                str(tx.get("payment_channel", ""))
                if tx.get("payment_channel")
                else None
            ),
            "logo_url": tx.get("logo_url"),
            "website": tx.get("website"),
            "personal_finance_category_primary": pfc_primary,
            "personal_finance_category": pfc_dict,
            "personal_finance_category_icon_url": tx.get(
                "personal_finance_category_icon_url"
            ),
            "counterparties": counterparties,
        }

    return {
        "added": [_tx_to_dict(tx) for tx in response.get("added", [])],
        "modified": [_tx_to_dict(tx) for tx in response.get("modified", [])],
        "removed": [r.get("transaction_id", "") for r in response.get("removed", [])],
        "next_cursor": response.get("next_cursor", ""),
        "has_more": bool(response.get("has_more", False)),
    }


def remove_item(access_token: str) -> None:
    client = _make_client()
    request = ItemRemoveRequest(access_token=access_token)
    client.item_remove(request)


def get_institution(institution_id: str) -> dict:
    client = _make_client()
    request = InstitutionsGetByIdRequest(
        institution_id=institution_id,
        country_codes=[CountryCode("US")],
    )
    response = client.institutions_get_by_id(request)
    institution = response.get("institution", {})
    return {
        "name": institution.get("name", ""),
        "logo": institution.get("logo"),
        "primary_color": institution.get("primary_color"),
    }

from __future__ import annotations

from app.core.config import settings


def encrypt_token(plaintext: str) -> str:
    key = settings.PLAID_TOKEN_ENCRYPTION_KEY
    if not key:
        return plaintext
    from cryptography.fernet import Fernet

    f = Fernet(key.encode())
    return f.encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    key = settings.PLAID_TOKEN_ENCRYPTION_KEY
    if not key:
        return ciphertext
    from cryptography.fernet import Fernet

    f = Fernet(key.encode())
    return f.decrypt(ciphertext.encode()).decode()

"""Environment configuration for the API.

Only this module reads environment variables. Keeping access centralized makes
it easier to audit the project and prevents secret keys from leaking into the
browser bundle.
"""

from dataclasses import dataclass
import os


def _split_origins(value: str) -> list[str]:
    return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    publishable_key: str
    secret_key: str
    allowed_origins: list[str]
    password_redirect_url: str
    turnstile_site_key: str
    vapid_public_key: str

    @property
    def is_configured(self) -> bool:
        return bool(self.supabase_url and self.publishable_key and self.secret_key)


settings = Settings(
    supabase_url=os.getenv("SUPABASE_URL", "").rstrip("/"),
    publishable_key=os.getenv("SUPABASE_PUBLISHABLE_KEY", os.getenv("SUPABASE_ANON_KEY", "")),
    secret_key=os.getenv("SUPABASE_SECRET_KEY", os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")),
    allowed_origins=_split_origins(os.getenv("BARBER_HUB_ALLOWED_ORIGINS", "")),
    password_redirect_url=os.getenv(
        "BARBER_HUB_PASSWORD_REDIRECT_URL",
        "https://barberhuboficial.vercel.app/html/redefinir-senha.html",
    ),
    turnstile_site_key=os.getenv("BARBER_HUB_TURNSTILE_SITE_KEY", "").strip(),
    vapid_public_key=os.getenv("BARBER_HUB_VAPID_PUBLIC_KEY", "").strip(),
)

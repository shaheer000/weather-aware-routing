import logging

import requests
from django.conf import settings
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

# Free public APIs occasionally drop connections or rate limit briefly.
RETRY_POLICY = Retry(
    total=2,
    backoff_factor=0.5,
    status_forcelist=(429, 502, 503, 504),
    allowed_methods=("GET",),
)

session = requests.Session()
session.mount("https://", HTTPAdapter(max_retries=RETRY_POLICY))
session.headers["User-Agent"] = settings.HTTP_USER_AGENT


class ProviderError(Exception):
    """A third-party API failed or returned unusable data."""


def get_json(url, params):
    try:
        response = session.get(
            url, params=params, timeout=settings.HTTP_TIMEOUT_SECONDS
        )
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as error:
        logger.exception("Request to %s failed", url)
        raise ProviderError(f"Upstream service unavailable: {url}") from error

"""Request parsing and validation helpers."""

from datetime import datetime
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

from .errors import ApiError


MONEY_QUANT = Decimal("0.01")


def parse_int(value, field_name, default=None, minimum=None, maximum=None):
    if value in (None, ""):
        return default
    try:
        number = int(value)
    except (TypeError, ValueError) as exc:
        raise ApiError(f"{field_name}必须是整数") from exc
    if minimum is not None and number < minimum:
        raise ApiError(f"{field_name}不能小于 {minimum}")
    if maximum is not None and number > maximum:
        raise ApiError(f"{field_name}不能大于 {maximum}")
    return number


def parse_money(value, field_name="金额", positive=False):
    if value is None or str(value).strip() == "":
        raise ApiError(f"{field_name}不能为空")
    try:
        amount = Decimal(str(value).strip()).quantize(MONEY_QUANT, rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError) as exc:
        raise ApiError(f"{field_name}必须是有效数字") from exc
    if amount < 0:
        raise ApiError(f"{field_name}不能小于 0")
    if positive and amount <= 0:
        raise ApiError(f"{field_name}必须大于 0")
    if amount > Decimal("99999999.99"):
        raise ApiError(f"{field_name}不能超过 99999999.99")
    return amount


def parse_date(value):
    if not value:
        return datetime.now().replace(hour=12, minute=0, second=0, microsecond=0)
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise ApiError("日期格式必须为 YYYY-MM-DD") from exc


def parse_month(value, default_current=False):
    if not value:
        if not default_current:
            return "", None, None
        value = datetime.now().strftime("%Y-%m")
    try:
        start = datetime.strptime(value, "%Y-%m")
    except (TypeError, ValueError) as exc:
        raise ApiError("月份格式必须为 YYYY-MM") from exc
    if start.month == 12:
        end = datetime(start.year + 1, 1, 1)
    else:
        end = datetime(start.year, start.month + 1, 1)
    return value, start, end


def month_add(month_start, offset):
    month = month_start.month - 1 + offset
    year = month_start.year + month // 12
    month = month % 12 + 1
    return datetime(year, month, 1)

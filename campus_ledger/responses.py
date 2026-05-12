"""Consistent API response helpers."""


def api_response(code=200, msg="success", data=None, http_status=200):
    return {"code": code, "msg": msg, "data": data or {}}, http_status

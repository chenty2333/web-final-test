"""Application error handling."""

from werkzeug.exceptions import HTTPException

from .responses import api_response


class ApiError(Exception):
    def __init__(self, msg, code=400, http_status=400, data=None):
        super().__init__(msg)
        self.msg = msg
        self.code = code
        self.http_status = http_status
        self.data = data or {}


def wants_api_response(request):
    return request.path.startswith("/api/")


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def api_error(error):
        app.logger.info("API error on %s: %s", error.http_status, error.msg)
        return api_response(error.code, error.msg, error.data, error.http_status)

    @app.errorhandler(HTTPException)
    def http_error(error):
        from flask import request, send_from_directory

        if error.code == 404 and not wants_api_response(request):
            return send_from_directory(app.config["PROJECT_ROOT"], "index.html")
        if wants_api_response(request):
            app.logger.warning("HTTP %s on %s: %s", error.code, request.path, error.description)
            return api_response(error.code, error.description, {}, error.code)
        return error

    @app.errorhandler(Exception)
    def unhandled_error(error):
        from flask import request

        app.logger.exception("Unhandled error on %s", request.path)
        if wants_api_response(request):
            return api_response(500, "服务器内部错误，请查看日志", {}, 500)
        return "服务器内部错误，请查看日志", 500

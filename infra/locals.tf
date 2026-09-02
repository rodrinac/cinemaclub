locals {
  name_prefix                  = replace("${trimspace(var.service_name)}-${trimspace(var.api_stage_name)}", "/[^a-zA-Z0-9-]/", "-")
  lambda_function_name         = substr("${local.name_prefix}-tmdb-proxy", 0, 64)
  rest_api_name                = substr("${local.name_prefix}-rest-api", 0, 128)
  access_log_group_name        = "/aws/apigateway/${local.name_prefix}-access"
  execution_log_group_name     = "API-Gateway-Execution-Logs_${aws_api_gateway_rest_api.tmdb_proxy.id}/${var.api_stage_name}"
  lambda_log_group_name        = "/aws/lambda/${local.lambda_function_name}"
  lambda_archive_path          = "${path.module}/build/tmdb-proxy-lambda.zip"
  stage_invoke_url             = "https://${aws_api_gateway_rest_api.tmdb_proxy.id}.execute-api.${var.aws_region}.amazonaws.com/${var.api_stage_name}"
  cors_enabled                 = var.cors_allow_origin != null
  rate_limit_enabled           = var.rate_limit_rps != null && var.rate_limit_burst != null
  gateway_throttle_retry_after = local.rate_limit_enabled ? ceil(1 / var.rate_limit_rps) : 1
  lambda_environment = merge(
    {
      TMDB_SECRET_ARN   = var.tmdb_secret_arn
      CACHE_MAX_ENTRIES = tostring(var.cache_max_entries)
    },
    local.cors_enabled ? { CORS_ALLOW_ORIGIN = trimspace(var.cors_allow_origin) } : {},
    local.rate_limit_enabled ? {
      RATE_LIMIT_RPS   = tostring(var.rate_limit_rps)
      RATE_LIMIT_BURST = tostring(var.rate_limit_burst)
    } : {},
  )
  alarm_actions = var.alarm_notification_arn == null ? [] : [var.alarm_notification_arn]
  api_gateway_response_parameters = local.cors_enabled ? {
    "gatewayresponse.header.Access-Control-Allow-Origin" = "'${trimspace(var.cors_allow_origin)}'"
    "gatewayresponse.header.Vary"                        = "'Origin'"
  } : {}
  common_tags = var.tags
}

check "cors_allow_origin_not_blank" {
  assert {
    condition     = var.cors_allow_origin == null ? true : trimspace(var.cors_allow_origin) != ""
    error_message = "cors_allow_origin must be null or a non-empty exact origin."
  }
}

check "rate_limit_pair" {
  assert {
    condition     = (var.rate_limit_rps == null) == (var.rate_limit_burst == null)
    error_message = "rate_limit_rps and rate_limit_burst must both be set or both be null."
  }
}

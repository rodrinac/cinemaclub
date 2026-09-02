resource "aws_api_gateway_rest_api" "tmdb_proxy" {
  name = local.rest_api_name

  endpoint_configuration {
    types = ["REGIONAL"]
  }

  tags = local.common_tags
}

resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.tmdb_proxy.id
  parent_id   = aws_api_gateway_rest_api.tmdb_proxy.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "root_any" {
  rest_api_id   = aws_api_gateway_rest_api.tmdb_proxy.id
  resource_id   = aws_api_gateway_rest_api.tmdb_proxy.root_resource_id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_method" "proxy_any" {
  rest_api_id   = aws_api_gateway_rest_api.tmdb_proxy.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "root_lambda" {
  rest_api_id             = aws_api_gateway_rest_api.tmdb_proxy.id
  resource_id             = aws_api_gateway_rest_api.tmdb_proxy.root_resource_id
  http_method             = aws_api_gateway_method.root_any.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tmdb_proxy.invoke_arn
}

resource "aws_api_gateway_integration" "proxy_lambda" {
  rest_api_id             = aws_api_gateway_rest_api.tmdb_proxy.id
  resource_id             = aws_api_gateway_resource.proxy.id
  http_method             = aws_api_gateway_method.proxy_any.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.tmdb_proxy.invoke_arn
}

resource "aws_lambda_permission" "apigateway_invoke" {
  statement_id  = "AllowExecutionFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.tmdb_proxy.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.tmdb_proxy.execution_arn}/*/*"
}

resource "aws_api_gateway_gateway_response" "default_4xx" {
  rest_api_id   = aws_api_gateway_rest_api.tmdb_proxy.id
  response_type = "DEFAULT_4XX"
  status_code   = "400"

  response_parameters = local.api_gateway_response_parameters

  response_templates = {
    "application/json" = jsonencode({
      error = "Request rejected by the API gateway."
    })
  }
}

resource "aws_api_gateway_gateway_response" "default_5xx" {
  rest_api_id   = aws_api_gateway_rest_api.tmdb_proxy.id
  response_type = "DEFAULT_5XX"
  status_code   = "500"

  response_parameters = local.api_gateway_response_parameters

  response_templates = {
    "application/json" = jsonencode({
      error = "The API gateway could not process the request."
    })
  }
}

resource "aws_api_gateway_gateway_response" "throttled" {
  rest_api_id   = aws_api_gateway_rest_api.tmdb_proxy.id
  response_type = "THROTTLED"
  status_code   = "429"

  response_parameters = merge(
    local.api_gateway_response_parameters,
    local.rate_limit_enabled ? {
      "gatewayresponse.header.Retry-After" = "'${local.gateway_throttle_retry_after}'"
    } : {},
  )

  response_templates = {
    "application/json" = jsonencode({
      error = "Too many requests. Please retry shortly."
      parameters = {
        retry_after = local.gateway_throttle_retry_after
      }
    })
  }
}

resource "aws_api_gateway_deployment" "tmdb_proxy" {
  rest_api_id = aws_api_gateway_rest_api.tmdb_proxy.id

  triggers = {
    redeployment = sha1(jsonencode({
      root_method            = aws_api_gateway_method.root_any.id
      proxy_method           = aws_api_gateway_method.proxy_any.id
      root_integration       = aws_api_gateway_integration.root_lambda.id
      proxy_integration      = aws_api_gateway_integration.proxy_lambda.id
      default_4xx_response   = aws_api_gateway_gateway_response.default_4xx.id
      default_5xx_response   = aws_api_gateway_gateway_response.default_5xx.id
      throttled_response     = aws_api_gateway_gateway_response.throttled.id
      lambda_source_code_sha = data.archive_file.lambda.output_base64sha256
    }))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.root_lambda,
    aws_api_gateway_integration.proxy_lambda,
    aws_lambda_permission.apigateway_invoke,
  ]
}

resource "aws_api_gateway_stage" "tmdb_proxy" {
  rest_api_id   = aws_api_gateway_rest_api.tmdb_proxy.id
  deployment_id = aws_api_gateway_deployment.tmdb_proxy.id
  stage_name    = var.api_stage_name

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_access.arn
    format = jsonencode({
      requestId          = "$context.requestId"
      ip                 = "$context.identity.sourceIp"
      requestTime        = "$context.requestTime"
      httpMethod         = "$context.httpMethod"
      resourcePath       = "$context.resourcePath"
      status             = "$context.status"
      responseLength     = "$context.responseLength"
      integrationStatus  = "$context.integrationStatus"
      integrationLatency = "$context.integrationLatency"
      errorMessage       = "$context.error.message"
    })
  }

  xray_tracing_enabled = false
  tags                 = local.common_tags

  depends_on = [
    aws_api_gateway_account.this,
    aws_cloudwatch_log_group.api_access,
    aws_cloudwatch_log_group.api_execution,
  ]
}

resource "aws_api_gateway_method_settings" "all_methods" {
  rest_api_id = aws_api_gateway_rest_api.tmdb_proxy.id
  stage_name  = aws_api_gateway_stage.tmdb_proxy.stage_name
  method_path = "*/*"

  settings {
    data_trace_enabled     = false
    logging_level          = "ERROR"
    metrics_enabled        = true
    throttling_burst_limit = local.rate_limit_enabled ? var.rate_limit_burst : null
    throttling_rate_limit  = local.rate_limit_enabled ? var.rate_limit_rps : null
  }
}

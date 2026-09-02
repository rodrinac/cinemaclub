output "stage_invoke_url" {
  description = "Base invoke URL for the deployed REST API stage. Append /api for the client-facing proxy base URL."
  value       = local.stage_invoke_url
}

output "movies_api_base_url" {
  description = "Client-facing base URL to assign to EXPO_PUBLIC_MOVIES_API_URL."
  value       = "${local.stage_invoke_url}/api"
}

output "rest_api_id" {
  description = "REST API identifier."
  value       = aws_api_gateway_rest_api.tmdb_proxy.id
}

output "stage_name" {
  description = "Deployed API Gateway stage name."
  value       = aws_api_gateway_stage.tmdb_proxy.stage_name
}

output "lambda_function_name" {
  description = "Lambda function name."
  value       = aws_lambda_function.tmdb_proxy.function_name
}

output "lambda_log_group_name" {
  description = "CloudWatch log group name for the Lambda function."
  value       = aws_cloudwatch_log_group.lambda.name
}

output "api_access_log_group_name" {
  description = "CloudWatch log group name for API Gateway access logs."
  value       = aws_cloudwatch_log_group.api_access.name
}

output "api_execution_log_group_name" {
  description = "CloudWatch log group name for API Gateway execution logs."
  value       = aws_cloudwatch_log_group.api_execution.name
}

output "alarm_names" {
  description = "Alarm names created for the TMDB proxy stack."
  value = compact([
    try(aws_cloudwatch_metric_alarm.lambda_errors[0].alarm_name, null),
    try(aws_cloudwatch_metric_alarm.lambda_throttles[0].alarm_name, null),
    try(aws_cloudwatch_metric_alarm.lambda_duration[0].alarm_name, null),
    try(aws_cloudwatch_metric_alarm.api_gateway_5xx[0].alarm_name, null),
  ])
}

resource "aws_cloudwatch_log_group" "lambda" {
  name              = local.lambda_log_group_name
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_access" {
  name              = local.access_log_group_name
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "api_execution" {
  name              = local.execution_log_group_name
  retention_in_days = var.log_retention_days
  tags              = local.common_tags
}

data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = "${path.module}/../server"
  output_path = local.lambda_archive_path
}

resource "aws_lambda_function" "tmdb_proxy" {
  function_name    = local.lambda_function_name
  role             = aws_iam_role.lambda.arn
  handler          = "tmdb-lambda.handler"
  runtime          = "nodejs22.x"
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  timeout          = var.lambda_timeout_seconds
  memory_size      = var.lambda_memory_size
  publish          = false

  environment {
    variables = local.lambda_environment
  }

  depends_on = [aws_cloudwatch_log_group.lambda]
  tags       = local.common_tags
}

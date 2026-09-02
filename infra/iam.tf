data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = substr("${local.name_prefix}-lambda-role", 0, 64)
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "lambda_permissions" {
  statement {
    sid = "WriteLambdaLogs"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      aws_cloudwatch_log_group.lambda.arn,
      "${aws_cloudwatch_log_group.lambda.arn}:*",
    ]
  }

  statement {
    sid       = "ReadTmdbSecret"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.tmdb_secret_arn]
  }
}

resource "aws_iam_role_policy" "lambda_permissions" {
  name   = substr("${local.name_prefix}-lambda-policy", 0, 128)
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_permissions.json
}

data "aws_iam_policy_document" "apigateway_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["apigateway.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "apigateway_logs" {
  name               = substr("${local.name_prefix}-apigw-logs-role", 0, 64)
  assume_role_policy = data.aws_iam_policy_document.apigateway_assume_role.json
  tags               = local.common_tags
}

data "aws_iam_policy_document" "apigateway_logs" {
  statement {
    sid = "WriteApiGatewayLogs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:DescribeLogStreams",
      "logs:PutLogEvents",
      "logs:GetLogEvents",
      "logs:FilterLogEvents",
    ]
    resources = [
      aws_cloudwatch_log_group.api_access.arn,
      "${aws_cloudwatch_log_group.api_access.arn}:*",
      aws_cloudwatch_log_group.api_execution.arn,
      "${aws_cloudwatch_log_group.api_execution.arn}:*",
    ]
  }

  statement {
    sid       = "DescribeApiGatewayLogGroups"
    actions   = ["logs:DescribeLogGroups"]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "apigateway_logs" {
  name   = substr("${local.name_prefix}-apigw-logs-policy", 0, 128)
  role   = aws_iam_role.apigateway_logs.id
  policy = data.aws_iam_policy_document.apigateway_logs.json
}

resource "aws_api_gateway_account" "this" {
  cloudwatch_role_arn = aws_iam_role.apigateway_logs.arn
}

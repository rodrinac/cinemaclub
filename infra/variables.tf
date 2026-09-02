variable "service_name" {
  type        = string
  description = "Base service name used to derive AWS resource names."

  validation {
    condition     = trimspace(var.service_name) != ""
    error_message = "service_name must not be blank."
  }
}

variable "api_stage_name" {
  type        = string
  description = "API Gateway stage name."

  validation {
    condition     = trimspace(var.api_stage_name) != ""
    error_message = "api_stage_name must not be blank."
  }
}

variable "aws_region" {
  type        = string
  description = "AWS region for the TMDB proxy deployment."

  validation {
    condition     = trimspace(var.aws_region) != ""
    error_message = "aws_region must not be blank."
  }
}

variable "tmdb_secret_arn" {
  type        = string
  sensitive   = true
  description = "ARN of the Secrets Manager secret that stores the TMDB bearer token."

  validation {
    condition     = trimspace(var.tmdb_secret_arn) != ""
    error_message = "tmdb_secret_arn must not be blank."
  }
}

variable "cors_allow_origin" {
  type        = string
  default     = null
  nullable    = true
  description = "Exact browser origin allowed for CORS. Leave null to disable CORS headers entirely."

  validation {
    condition = var.cors_allow_origin == null || (
      trimspace(var.cors_allow_origin) != "" &&
      length(regexall(",", var.cors_allow_origin)) == 0
    )
    error_message = "cors_allow_origin must be null or a single non-empty exact origin."
  }
}

variable "rate_limit_rps" {
  type        = number
  default     = null
  nullable    = true
  description = "Optional local Lambda request refill rate per second. Set with rate_limit_burst or leave both null."

  validation {
    condition     = var.rate_limit_rps == null || var.rate_limit_rps > 0
    error_message = "rate_limit_rps must be null or a positive finite number."
  }
}

variable "rate_limit_burst" {
  type        = number
  default     = null
  nullable    = true
  description = "Optional local Lambda request burst capacity. Set with rate_limit_rps or leave both null."

  validation {
    condition     = var.rate_limit_burst == null || var.rate_limit_burst >= 1
    error_message = "rate_limit_burst must be null or at least 1."
  }
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch log retention in days."

  validation {
    condition = contains([
      1,
      3,
      5,
      7,
      14,
      30,
      60,
      90,
      120,
      150,
      180,
      365,
      400,
      545,
      731,
      1096,
      1827,
      2192,
      2557,
      2922,
      3288,
      3653,
    ], var.log_retention_days)
    error_message = "log_retention_days must be a valid CloudWatch Logs retention value."
  }
}

variable "lambda_memory_size" {
  type        = number
  default     = 256
  description = "Lambda memory size in MB."

  validation {
    condition     = var.lambda_memory_size >= 128 && var.lambda_memory_size <= 10240
    error_message = "lambda_memory_size must stay within AWS Lambda limits."
  }
}

variable "lambda_timeout_seconds" {
  type        = number
  default     = 10
  description = "Lambda runtime ceiling in seconds. The handler keeps a small upstream response margin inside this budget."

  validation {
    condition     = var.lambda_timeout_seconds >= 1 && var.lambda_timeout_seconds <= 10
    error_message = "lambda_timeout_seconds must be between 1 and 10 seconds."
  }
}

variable "cache_max_entries" {
  type        = number
  default     = 100
  description = "Maximum number of successful TMDB responses to keep in the in-memory cache."

  validation {
    condition = (
      var.cache_max_entries >= 1 &&
      floor(var.cache_max_entries) == var.cache_max_entries &&
      var.cache_max_entries <= 9007199254740991
    )
    error_message = "cache_max_entries must be a positive safe integer."
  }
}

variable "tags" {
  type        = map(string)
  default     = {}
  description = "Optional non-account-specific tags applied to supported resources."
}

variable "alarm_notification_arn" {
  type        = string
  default     = null
  nullable    = true
  description = "Optional SNS topic ARN or other supported alarm action target."
}

variable "alarm_period_seconds" {
  type        = number
  default     = 60
  description = "Period, in seconds, used for alarm evaluation."

  validation {
    condition     = var.alarm_period_seconds >= 60
    error_message = "alarm_period_seconds must be at least 60 seconds."
  }
}

variable "alarm_evaluation_periods" {
  type        = number
  default     = 1
  description = "How many periods to evaluate before the alarm state changes."

  validation {
    condition     = var.alarm_evaluation_periods >= 1
    error_message = "alarm_evaluation_periods must be at least 1."
  }
}

variable "alarm_datapoints_to_alarm" {
  type        = number
  default     = 1
  description = "How many breaching datapoints are required before the alarm state changes."

  validation {
    condition     = var.alarm_datapoints_to_alarm >= 1
    error_message = "alarm_datapoints_to_alarm must be at least 1."
  }
}

variable "lambda_error_alarm_threshold" {
  type        = number
  default     = null
  nullable    = true
  description = "Optional Lambda Errors metric threshold."
}

variable "lambda_throttle_alarm_threshold" {
  type        = number
  default     = null
  nullable    = true
  description = "Optional Lambda Throttles metric threshold."
}

variable "lambda_duration_alarm_threshold_ms" {
  type        = number
  default     = null
  nullable    = true
  description = "Optional Lambda Duration metric threshold in milliseconds."
}

variable "api_5xx_alarm_threshold" {
  type        = number
  default     = null
  nullable    = true
  description = "Optional API Gateway 5XXError metric threshold."
}

variable "skip_aws_provider_validation" {
  type        = bool
  default     = false
  description = "Skip AWS provider credential checks for placeholder CI plan validation only."
}

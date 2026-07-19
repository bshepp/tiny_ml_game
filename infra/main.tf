terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "name" {
  type        = string
  description = "Base name for all resources"
  default     = "roshambot"
}

variable "allowed_origins" {
  type        = list(string)
  description = "Origins allowed to call the Function URL"
  default = [
    "https://roshambot.briansheppard.com",
    "http://localhost:3000",
  ]
}

# ----- DynamoDB --------------------------------------------------------------

resource "aws_dynamodb_table" "rounds" {
  name         = "${var.name}-rounds"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }
  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = false
  }
}

# ----- IAM -------------------------------------------------------------------

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.name}-lambda-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "ddb" {
  statement {
    actions = [
      "dynamodb:PutItem",
      "dynamodb:Query",
    ]
    resources = [aws_dynamodb_table.rounds.arn]
  }
}

resource "aws_iam_policy" "ddb" {
  name   = "${var.name}-ddb"
  policy = data.aws_iam_policy_document.ddb.json
}

resource "aws_iam_role_policy_attachment" "ddb" {
  role       = aws_iam_role.lambda.name
  policy_arn = aws_iam_policy.ddb.arn
}

# ----- Lambda ----------------------------------------------------------------

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/build/lambda.zip"
  excludes    = ["index.test.mjs"]
}

resource "aws_lambda_function" "api" {
  function_name    = "${var.name}-api"
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs22.x"
  handler          = "index.handler"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 10
  memory_size      = 256

  # Bound worst-case spend on this public, unauthenticated endpoint.
  reserved_concurrent_executions = 10

  environment {
    variables = {
      TABLE_NAME      = aws_dynamodb_table.rounds.name
      ALLOWED_ORIGINS = join(",", var.allowed_origins)
    }
  }
}

resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = var.allowed_origins
    allow_methods = ["GET", "POST"]
    allow_headers = ["content-type"]
    max_age       = 86400
  }
}

# Function URLs with authorization_type = "NONE" require an explicit
# resource-based policy granting lambda:InvokeFunctionUrl to principal "*"
# with a FunctionUrlAuthType = NONE condition. The AWS console adds this
# automatically; Terraform does not.
resource "aws_lambda_permission" "public_invoke_function_url" {
  statement_id           = "AllowPublicFunctionUrlInvoke"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.api.function_name
  principal              = "*"
  function_url_auth_type = "NONE"
}

# Since October 2025, function URLs additionally require lambda:InvokeFunction
# (scoped to URL calls via the InvokedViaFunctionUrl condition). Without this
# second statement, every public request gets 403 AccessDeniedException.
# https://docs.aws.amazon.com/lambda/latest/dg/urls-auth.html
resource "aws_lambda_permission" "public_invoke_via_function_url" {
  statement_id             = "AllowPublicInvokeViaFunctionUrl"
  action                   = "lambda:InvokeFunction"
  function_name            = aws_lambda_function.api.function_name
  principal                = "*"
  invoked_via_function_url = true
}

# ----- Outputs ---------------------------------------------------------------

output "function_url" {
  value       = aws_lambda_function_url.api.function_url
  description = "Set REACT_APP_TELEMETRY_URL to this value (without trailing slash)"
}

output "table_name" {
  value = aws_dynamodb_table.rounds.name
}

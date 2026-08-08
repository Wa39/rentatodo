resource "aws_s3_bucket_cors_configuration" "items" {
  bucket = "rentatodo-items"

  cors_rule {
    allowed_methods = ["GET", "PUT", "HEAD"]
    allowed_origins = [
      "https://rentatodo-web.vercel.app",
      "https://*.vercel.app",
      "http://localhost:8081",
    ]
    allowed_headers = ["*"]
    max_age_seconds = 3000
  }
}

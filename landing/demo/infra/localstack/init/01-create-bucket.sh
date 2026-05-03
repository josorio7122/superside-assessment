#!/usr/bin/env bash
set -e
awslocal s3 mb s3://studio-demo || true
awslocal s3api put-bucket-cors --bucket studio-demo --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET","PUT","POST","HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}'
echo "[init] bucket studio-demo ready"

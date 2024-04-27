#!/bin/bash

url="http://127.0.0.1:5001/vodo-ai/us-central1/msg"
session="$1"
msg="$2"

curl \
    --url-query	"msg=${msg}" \
    --header "X-Session-Id: ${session}"\
    --write-out	"\n%header{X-Session-Id}\n" \
    "${url}"
echo

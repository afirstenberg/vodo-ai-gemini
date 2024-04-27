#!/bin/bash

date=`date "+%Y%m%d-%H%M%S"`

dir=`dirname $0`
msg="${dir}/msg.sh"

input="$1"
session="test-${date}-${RANDOM}"
while read -r line; do
  echo "$line"
  "$msg" "$session" "$line"
done < "${input}"

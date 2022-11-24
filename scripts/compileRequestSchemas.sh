#!/bin/bash

# Compile the request body validation schemas (TS types -> json schemas)
# Using typescript-json-schema - see https://github.com/vega/ts-json-schema-generator
# Run this script if the types are changed or new ones added

npm install -g ts-json-schema-generator

types="EmailRequestBody LetterRequestBody QueueRecord"
source="src/interfaces"
destination="src/schemas"


for type in $types
do
  ts-json-schema-generator --path "${source}/*.ts" --type "${type}" --validationKeywords notEmpty --tsconfig "tsconfig.json" --out "${destination}/${type}.schema.json"
done

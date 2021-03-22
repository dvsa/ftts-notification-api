# Notification API

Notification API wrapping GOV.UK Notify for sending email and letter notifications

Azure Function app with six functions:
- **email**: http trigger function for api post 'email' endpoint
- **letter**: http trigger function for api post 'letter' endpoint
- **sender**: queue trigger function for sending notifications picked up off the request queue
- **status**: time trigger function for checking status of notifications picked up off the status queue
- **request-dlq**: queue trigger function for handling 'dead letters' on the request queue
- **status-dlq**: queue trigger function for handling 'dead letters' on the status queue

Each has its own folder in the project root with a `function.json` config

## Build

Install node modules:
```
npm install
```

Compile the ts source:
```
npm run build
```

#### Schemas

Recompile the json validation schemas if necessary - see `scripts/compileRequestSchemas.sh`

## Deploy

Deploy via VSCode with the Azure Functions extension

## Tests

All tests are housed under `tests/` directory in root

Run all the tests:
```
npm run test
```

Watch the tests:
```
npm run test:watch
```

Run test coverage:
```
npm run test:coverage
```
See the generated `coverage` directory for the results

## Queues

### Request queue record structure
| Field name | mandatory/optional | Description | Example |
| ---------- | ------------------ | ----------- | ------- |
|message_content|y|content of message (email/letter) to be delivered|"Dear Sir, Lorem ipsum. Regards DVSA"|
|message_type|y|email/letter/message|email/letter/sms|
|target|y|is it for recipient from GB or NI|NI/GB|
|email|y for email|look below||
|letter|y for letter|look below||
|no_of_request_retries|y|default 0, incremented with each retry on the request queue in case of notify send error, is reset once pushed to status queue|0|
|no_of_retries|y|default 0, incremented with each retry on the status queue|0|
|reference|n|external system reference number - eg. booking reference number|1234567890|
|context_id|n|external system context_id for request tracking purpose|1234-5678-azq1-5tgb|
|trace_id|y|internal id for tracking purpose|1234-5678-azq1-5tgb|

### Status queue record structure
Same as request queue record but with additional fields:
| Field name | mandatory/optional | Description | Example |
| ---------- | ------------------ | ----------- | ------- |
|id|y|id for the notification as returned from gov.notify|1234-5678-azq1-5tgb|
|date|y|date/time that the notification was sent|Mon Mar 09 2020 13:54:11|
|status|y|status of the notification from querying gov.notify|sending|

email field will contain:
* message_subject
* email_address

letter field will contain
* name
* address_line_1
* address_line_2
* address_line_3
* address_line_4
* address_line_5
* address_line_6
* postcode

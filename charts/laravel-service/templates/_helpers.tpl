{{- define "svc.fullname" -}}{{ required "name is required" .Values.name }}{{- end -}}

{{- define "svc.env" -}}
- { name: APP_NAME, value: {{ .Values.name | quote }} }
- { name: APP_ENV, value: local }
- { name: APP_DEBUG, value: "true" }
# Deterministic local-only key (32 bytes); real secrets never live in this chart.
- { name: APP_KEY, value: {{ printf "base64:%s" (sha256sum .Values.name | trunc 32 | b64enc) | quote }} }
- { name: SERVICE_NAME, value: {{ .Values.name | quote }} }
- { name: DB_CONNECTION, value: pgsql }
- { name: DB_HOST, value: postgres }
- { name: DB_PORT, value: "5432" }
- { name: DB_DATABASE, value: {{ .Values.name | quote }} }
- { name: DB_USERNAME, value: {{ .Values.name | quote }} }
- { name: DB_PASSWORD, value: {{ .Values.name | quote }} }
- { name: REDIS_HOST, value: redis }
- { name: CACHE_STORE, value: redis }
- { name: QUEUE_CONNECTION, value: database }
- { name: MAIL_MAILER, value: smtp }
- { name: MAIL_HOST, value: mailpit }
- { name: MAIL_PORT, value: "1025" }
- { name: KAFKA_BROKERS, value: "shopwise-kafka-bootstrap:9092" }
- { name: KAFKA_CONSUMER_GROUP_ID, value: {{ .Values.name | quote }} }
- { name: SCHEMA_REGISTRY_URL, value: "http://apicurio:8080/apis/registry/v3" }
- { name: IDENTITY_JWKS_URL, value: "http://identity:8000/.well-known/jwks.json" }
# In-cluster base URLs for service-to-service REST (checkout -> cart/pricing, ...).
{{- range list "identity" "catalog" "inventory" "pricing" "cart" "checkout" "payments" "orders" "notifications" }}
- { name: {{ upper . }}_URL, value: {{ printf "http://%s:8000" . | quote }} }
{{- end }}
- { name: OTEL_PHP_AUTOLOAD_ENABLED, value: "true" }
- { name: OTEL_SERVICE_NAME, value: {{ .Values.name | quote }} }
- { name: OTEL_TRACES_EXPORTER, value: otlp }
- { name: OTEL_METRICS_EXPORTER, value: otlp }
- { name: OTEL_LOGS_EXPORTER, value: otlp }
- { name: OTEL_EXPORTER_OTLP_PROTOCOL, value: http/protobuf }
- { name: OTEL_EXPORTER_OTLP_ENDPOINT, value: "http://otel:4318" }
- { name: OTEL_PROPAGATORS, value: "tracecontext,baggage" }
{{- range $k, $v := .Values.env }}
- { name: {{ $k }}, value: {{ $v | quote }} }
{{- end }}
{{- end -}}

{{- define "svc.container" -}}
image: {{ required "image is required" .root.Values.image }}
imagePullPolicy: IfNotPresent
env:
{{ include "svc.env" .root | indent 2 }}
envFrom:
  - secretRef: { name: {{ include "svc.fullname" .root }}-secrets, optional: true }
resources:
{{ toYaml .root.Values.resources | indent 2 }}
{{- end -}}

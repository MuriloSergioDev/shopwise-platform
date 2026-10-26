# Shopwise local environment. Usage:
#   tilt up                      # infra + every service whose repo exists next to this one
#   tilt up -- --only=ping,identity
#   tilt up -- --repos=../..     # from a git worktree: where the shopwise-* folders live
load('ext://helm_resource', 'helm_resource')

allow_k8s_contexts('k3d-shopwise')
config.define_string_list('only')
config.define_string('repos')
cfg = config.parse()
# string_list does not split on commas; accept both `--only=a,b` and `--only=a --only=b`.
only = [n.strip() for v in cfg.get('only', []) for n in v.split(',') if n.strip()]
repos = cfg.get('repos', '..')

# ---------- infrastructure ----------
helm_resource(
    'strimzi-operator',
    'oci://quay.io/strimzi-helm/strimzi-kafka-operator',
    flags=['--version=1.3.0'],
    labels=['infra'],
)

k8s_yaml(['infra/base/postgres.yaml', 'infra/base/redis.yaml', 'infra/base/mailpit.yaml',
          'infra/base/lgtm.yaml', 'infra/base/apicurio.yaml', 'infra/base/kafka-ui.yaml',
          'infra/base/kafka.yaml'])

k8s_resource('postgres', port_forwards='5432:5432', labels=['infra'])
k8s_resource('redis', labels=['infra'])
k8s_resource('mailpit', port_forwards='8025:8025', labels=['infra'], links=[link('http://localhost:8025', 'Mailpit')])
k8s_resource('lgtm', port_forwards='3030:3000', labels=['infra'], links=[link('http://localhost:3030', 'Grafana')])
k8s_resource('apicurio', port_forwards='8081:8080', resource_deps=['postgres'], labels=['infra'])
k8s_resource(new_name='kafka', objects=['shopwise:kafka', 'dual-role:kafkanodepool'],
             resource_deps=['strimzi-operator'], labels=['infra'],
             pod_readiness='ignore')
k8s_resource('kafka-ui', port_forwards='8082:8080', resource_deps=['kafka', 'apicurio'], labels=['infra'],
             links=[link('http://localhost:8082', 'Kafka UI')])

# ---------- Laravel services ----------
registry = read_yaml('services.yaml')

def wanted(name):
    return len(only) == 0 or name in only

# Local secrets (Stripe keys, ...): secrets/<service>.env, gitignored. Becomes the <service>-secrets Secret
# the chart already loads with envFrom. Returns the parsed file so Tilt can reuse values (stripe listen).
def service_secrets(name):
    path = 'secrets/%s.env' % name
    watch_file(path)
    if not os.path.exists(path):
        return {}
    k8s_yaml(local('kubectl create secret generic %s-secrets --from-env-file=%s --dry-run=client -o yaml' % (name, path),
                   quiet=True, echo_off=True))
    parsed = {}
    for line in str(read_file(path)).splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            parsed[k.strip()] = v.strip()
    return parsed

deployed = []    # names of services Tilt deploys this run
declared = []    # topics the deployed charts declare themselves
for svc in registry['services']:
    name = svc['name']
    path = repos + '/' + svc.get('repo', 'shopwise-' + name)
    if not wanted(name) or not os.path.exists(path + '/Dockerfile'):
        continue
    deployed.append(name)
    image = 'shopwise-' + name
    docker_build(
        image, path, target='dev',
        ignore=['vendor', 'node_modules', 'storage/logs', '.git'],
        live_update=[
            sync(path, '/app'),
            run('composer install --no-interaction', trigger=[path + '/composer.json', path + '/composer.lock']),
            run('php artisan octane:reload || true'),
        ],
    )
    extra = svc.get('set', [])
    k8s_yaml(helm('charts/laravel-service', name=name,
                  values=[path + '/deploy/values.yaml'],
                  set=['name=' + name, 'image=' + image] + extra))
    secrets = service_secrets(name)
    k8s_resource(name + '-http', port_forwards='%d:8000' % svc['port'],
                 objects=[name + '-secrets:secret'] if secrets else [],
                 resource_deps=['postgres', 'kafka', 'lgtm'], labels=[name])
    values = read_yaml(path + '/deploy/values.yaml', default={}) or {}
    declared += [t['name'] for t in values.get('topics', []) or []]
    for c in values.get('consumers', []) or []:
        k8s_resource(name + '-consumer-' + c['name'], resource_deps=['kafka', name + '-http'], labels=[name])
    if (values.get('scheduler') or {}).get('enabled', True):
        k8s_resource(name + '-scheduler', resource_deps=[name + '-http'], labels=[name])
    if (values.get('queue') or {}).get('enabled', False) or 'queue.enabled=true' in extra:
        k8s_resource(name + '-queue', resource_deps=[name + '-http'], labels=[name])

    # Test-mode Stripe webhooks → payments. Off by default: start it from the Tilt UI. Needs the Stripe CLI;
    # it authenticates with STRIPE_SECRET from secrets/payments.env (or a prior `stripe login`).
    if svc.get('webhook'):
        local_resource(
            'stripe-listen',
            serve_cmd='stripe listen --forward-to localhost:%d%s' % (svc['port'], svc['webhook']),
            serve_env={'STRIPE_API_KEY': secrets['STRIPE_SECRET']} if secrets.get('STRIPE_SECRET') else {},
            auto_init=False, trigger_mode=TRIGGER_MODE_MANUAL,
            resource_deps=[name + '-http'], labels=[name],
        )

# Every topic in services.yaml that no deployed chart declares, rendered exactly like the chart does
# (same names and labels), so it doesn't matter which side created it.
fallback = []
for svc in registry['services']:
    for topic in svc.get('topics', []):
        if topic in declared:
            continue
        for suffix in ['', '.dlq']:
            fallback.append({
                'apiVersion': 'kafka.strimzi.io/v1',
                'kind': 'KafkaTopic',
                'metadata': {
                    'name': (topic + suffix).replace('.', '-'),
                    'labels': {'strimzi.io/cluster': 'shopwise', 'shopwise.dev/owner': svc['name']},
                },
                'spec': {'topicName': topic + suffix, 'partitions': 3, 'replicas': 1},
            })
if fallback:
    k8s_yaml(encode_yaml_stream(fallback))
    k8s_resource(new_name='kafka-topics', resource_deps=['kafka'], labels=['infra'],
                 objects=['%s:kafkatopic' % t['metadata']['name'] for t in fallback])

# ---------- Nuxt apps run on the host for fast HMR; they reach services through the port-forwards ----------
for fe in registry['frontends']:
    path = repos + '/shopwise-' + fe['name']
    if not wanted(fe['name']) or not os.path.exists(path + '/package.json'):
        continue
    local_resource(fe['name'], serve_cmd='pnpm dev --port %d' % fe['port'], serve_dir=path,
                   resource_deps=[d + '-http' for d in fe.get('deps', []) if d in deployed],
                   links=[link('http://localhost:%d' % fe['port'], fe['name'])], labels=['frontend'])

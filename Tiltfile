# Shopwise local environment. Usage:
#   tilt up                      # infra + every service whose repo exists next to this one
#   tilt up -- --only=ping,identity
load('ext://helm_resource', 'helm_resource')

allow_k8s_contexts('k3d-shopwise')
config.define_string_list('only')
cfg = config.parse()
only = cfg.get('only', [])

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

for svc in registry['services']:
    name = svc['name']
    path = '../' + svc.get('repo', 'shopwise-' + name)
    if not wanted(name) or not os.path.exists(path + '/Dockerfile'):
        continue
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
    k8s_yaml(helm('charts/laravel-service', name=name,
                  values=[path + '/deploy/values.yaml'],
                  set=['name=' + name, 'image=' + image]))
    k8s_resource(name + '-http', port_forwards='%d:8000' % svc['port'],
                 resource_deps=['postgres', 'kafka', 'lgtm'], labels=[name])
    values = read_yaml(path + '/deploy/values.yaml', default={}) or {}
    for c in values.get('consumers', []):
        k8s_resource(name + '-consumer-' + c['name'], resource_deps=['kafka', name + '-http'], labels=[name])
    if values.get('scheduler', {}).get('enabled', True):
        k8s_resource(name + '-scheduler', resource_deps=[name + '-http'], labels=[name])

# ---------- Nuxt apps run on the host for fast HMR; they reach services through the port-forwards ----------
for fe in registry['frontends']:
    path = '../shopwise-' + fe['name']
    if not wanted(fe['name']) or not os.path.exists(path + '/package.json'):
        continue
    local_resource(fe['name'], serve_cmd='pnpm dev --port %d' % fe['port'], serve_dir=path,
                   links=[link('http://localhost:%d' % fe['port'], fe['name'])], labels=['frontend'])

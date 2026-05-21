---
name: kubernetes
description: Write and review Kubernetes manifests for Pods, Deployments, Services, Ingress, ConfigMaps, Secrets, and HPAs. Covers kubectl essentials, namespaces, labels/selectors, resource requests/limits, liveness/readiness/startup probes, and rolling updates. Use when authoring YAML for a K8s cluster, debugging pod scheduling or crashloops, configuring autoscaling, or hardening workloads for production.
---

# Kubernetes

Practical guide to authoring production-grade Kubernetes manifests and using `kubectl` effectively. Focuses on the core objects you touch daily and the small set of fields that account for most outages.

## Use this skill when
- Writing a `Deployment`, `Service`, `Ingress`, or `StatefulSet`
- Configuring probes, resource requests, or HorizontalPodAutoscaler
- Debugging `CrashLoopBackOff`, `ImagePullBackOff`, or `Pending` pods
- Setting up ConfigMaps and Secrets for application configuration
- Planning a rolling update or rollback strategy
- Reviewing manifests for security and scheduling correctness

## Do not use this skill when
- You only need to build a container image (use the `docker-containers` skill)
- You want to template/package a release (use the `helm-charts` skill)
- You are provisioning the cluster itself (use a Terraform/IaC skill)

## Core concepts
A `Pod` is the unit of scheduling; almost never create one directly. A `Deployment` manages a `ReplicaSet` which manages Pods. A `Service` gives Pods a stable virtual IP and DNS name, selected by labels. An `Ingress` routes external HTTP to Services. All state lives in etcd; controllers reconcile actual state toward declared state.

## Quick start
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  labels: {app: web}
spec:
  replicas: 3
  selector:
    matchLabels: {app: web}
  template:
    metadata:
      labels: {app: web}
    spec:
      containers:
        - name: web
          image: ghcr.io/org/web:1.2.3
          ports: [{containerPort: 8080}]
          resources:
            requests: {cpu: 100m, memory: 128Mi}
            limits:   {cpu: 500m, memory: 256Mi}
          readinessProbe:
            httpGet: {path: /healthz, port: 8080}
            periodSeconds: 5
          livenessProbe:
            httpGet: {path: /livez, port: 8080}
            initialDelaySeconds: 15
---
apiVersion: v1
kind: Service
metadata: {name: web}
spec:
  selector: {app: web}
  ports: [{port: 80, targetPort: 8080}]
```

## Key patterns

### Labels and selectors
Selectors are immutable on Deployments once created. Pick a stable label scheme up front: `app.kubernetes.io/name`, `app.kubernetes.io/instance`, `app.kubernetes.io/version`. Services find Pods by label, not by name.

### Probes: liveness vs readiness vs startup
- **readinessProbe**: gates traffic from the Service. Fail it during warmup or when overloaded.
- **livenessProbe**: restarts the container when it fails. Use sparingly; a misconfigured liveness probe causes crashloops.
- **startupProbe**: disables liveness until app finishes booting. Use for slow-starting JVMs/Rails apps instead of huge `initialDelaySeconds`.

### Resource requests and limits
Requests reserve capacity for scheduling. Limits cap usage; CPU over limit is throttled, memory over limit is OOMKilled. Always set requests; set memory limit equal to memory request to get Guaranteed QoS for critical workloads. Avoid CPU limits on latency-sensitive services (causes throttling).

### ConfigMap and Secret
```yaml
apiVersion: v1
kind: ConfigMap
metadata: {name: web-config}
data:
  LOG_LEVEL: info
  FEATURE_X: "true"
---
apiVersion: v1
kind: Secret
metadata: {name: web-secrets}
type: Opaque
stringData:
  DATABASE_URL: postgres://...
```
Mount as env or file:
```yaml
envFrom:
  - configMapRef: {name: web-config}
  - secretRef:    {name: web-secrets}
```

### Ingress
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata: {name: web}
spec:
  ingressClassName: nginx
  rules:
    - host: app.example.com
      http:
        paths:
          - {path: /, pathType: Prefix, backend: {service: {name: web, port: {number: 80}}}}
  tls: [{hosts: [app.example.com], secretName: web-tls}]
```

### HorizontalPodAutoscaler
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: {name: web}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource: {name: cpu, target: {type: Utilization, averageUtilization: 70}}
```
HPA needs CPU/memory `requests` set and metrics-server installed.

### Rolling updates
Default strategy. Tune with `maxUnavailable` (default 25%) and `maxSurge` (default 25%). For zero-disruption deploys, set `maxUnavailable: 0`. Always set a readiness probe or rolling updates will send traffic to not-yet-ready Pods.

### kubectl essentials
```bash
kubectl get pods -n prod -o wide
kubectl describe pod web-abc123 -n prod      # events at the bottom
kubectl logs -f web-abc123 -c sidecar --previous
kubectl exec -it web-abc123 -- sh
kubectl rollout status deploy/web
kubectl rollout undo deploy/web
kubectl apply -f manifest.yaml --dry-run=server
kubectl port-forward svc/web 8080:80
```

## Common pitfalls
- **Missing readiness probe**: rolling updates appear successful while users hit cold or crashing Pods. Always define one for any service receiving traffic.
- **Liveness probe equals readiness probe**: causes restart storms under load. Liveness should detect a stuck process; readiness detects not ready right now.
- **No resource requests**: scheduler treats the Pod as BestEffort; it is the first to be evicted under pressure.
- **Memory limit too low**: OOMKilled cycles with no clear log. Check `kubectl describe pod` and look for `Last State: Terminated, Reason: OOMKilled`.
- **`latest` image tag**: Pod restart pulls a different image than what shipped. Pin to immutable tags or digests.
- **Editing live resources with `kubectl edit`**: untracked drift from source-of-truth YAML. Always change the file and `kubectl apply`.
- **Secrets in env vars logged at boot**: app frameworks often print env on startup. Mount as files when possible.
- **CrashLoopBackOff with no logs**: container exits before logging. Check `kubectl logs --previous` and `kubectl describe pod` events; commonly a bad command, missing file, or failed init container.

## Reference
- Official docs: https://kubernetes.io/docs/concepts/
- kubectl cheat sheet: https://kubernetes.io/docs/reference/kubectl/cheatsheet/
- API reference: https://kubernetes.io/docs/reference/kubernetes-api/

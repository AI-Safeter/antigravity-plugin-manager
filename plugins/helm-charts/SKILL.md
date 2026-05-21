---
name: helm-charts
description: Author and operate Helm 3 charts for Kubernetes. Covers Chart.yaml, values.yaml, Go-template syntax, helm install/upgrade/rollback, dependencies, hooks, helm test, OCI repositories, and values override patterns. Use when packaging a Kubernetes app for distribution, debugging template rendering, managing chart releases, upgrading dependencies, or designing a configurable values schema.
---

# Helm Charts

Practical guide to writing and shipping Helm 3 charts. Focuses on the chart layout, Go-template patterns that survive review, and the release lifecycle (`install`, `upgrade`, `rollback`, `test`).

## Use this skill when
- Packaging a Kubernetes application into a reusable chart
- Templating manifests with Go templates and `values.yaml`
- Installing, upgrading, or rolling back releases with `helm`
- Managing subcharts and `Chart.yaml` dependencies
- Publishing charts to an OCI registry (GHCR, ECR, Artifact Hub)
- Diagnosing a failed upgrade or template render error

## Do not use this skill when
- You need raw Kubernetes manifests (use the `kubernetes` skill)
- You want a non-templated GitOps approach (consider Kustomize)
- You are provisioning the cluster itself (use Terraform/IaC)

## Core concepts
A chart is a directory of Go-template YAML plus a `values.yaml` of defaults. `helm install` renders templates with merged values, then applies the result to Kubernetes and records a release in a Secret. Each release has a revision; `helm upgrade` bumps it, `helm rollback` restores a previous one.

## Quick start
```
mychart/
  Chart.yaml
  values.yaml
  templates/
    deployment.yaml
    service.yaml
    _helpers.tpl
    NOTES.txt
```
```yaml
# Chart.yaml
apiVersion: v2
name: mychart
description: My app
type: application
version: 0.1.0          # chart version
appVersion: "1.2.3"     # app version
```
```yaml
# values.yaml
replicaCount: 2
image:
  repository: ghcr.io/org/web
  tag: ""               # falls back to .Chart.AppVersion
  pullPolicy: IfNotPresent
service:
  port: 80
```
```yaml
# templates/deployment.yaml (excerpt)
spec:
  replicas: {{ .Values.replicaCount }}
  template:
    spec:
      containers:
        - name: app
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports: [{containerPort: 8080}]
```
```bash
helm install web ./mychart -n prod --create-namespace
helm upgrade web ./mychart -n prod -f overrides.yaml
helm rollback web 1 -n prod
helm list -n prod
```

## Key patterns

### Named templates in `_helpers.tpl`
Centralize names and labels so every manifest stays consistent.
```yaml
{{- define "mychart.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- define "mychart.labels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}
```

### Values override precedence
Later wins: `values.yaml` < `-f override.yaml` < `--set key=value` < `--set-file` / `--set-string`. Use `-f` for env-specific files (`values-prod.yaml`) and `--set` for one-offs.

### Conditional blocks and ranges
```yaml
{{- if .Values.ingress.enabled }}
# ingress manifest
{{- end }}
{{- range .Values.extraEnv }}
- name: {{ .name }}
  value: {{ .value | quote }}
{{- end }}
```
Use `with` for scope changes and `range` for lists.

### Dependencies (subcharts)
```yaml
# Chart.yaml
dependencies:
  - name: postgresql
    version: "13.x.x"
    repository: oci://registry-1.docker.io/bitnamicharts
    condition: postgresql.enabled
```
```bash
helm dependency update ./mychart
```
Subchart values nest under the subchart name:
```yaml
postgresql:
  enabled: true
  auth:
    database: app
```

### Hooks
Run Jobs at release lifecycle points. Use sparingly; hooks are not part of the release manifest and are not deleted on uninstall by default.
```yaml
metadata:
  annotations:
    "helm.sh/hook": pre-upgrade,pre-install
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": before-hook-creation,hook-succeeded
```
Common uses: db migrations (`pre-upgrade`), seed data (`post-install`), smoke tests (`test`).

### helm test
Add a Pod with `annotations: {"helm.sh/hook": test}` under `templates/tests/`, then `helm test web -n prod` runs it after a release. Typical use: a `curl` Pod hitting `/healthz` on the Service.

### OCI repositories
Modern Helm uses OCI registries; the old `helm repo add` flow is being phased out.
```bash
helm package ./mychart
helm push mychart-0.1.0.tgz oci://ghcr.io/org/charts
helm install web oci://ghcr.io/org/charts/mychart --version 0.1.0
```

## Common pitfalls
- **`tpl` and string vs YAML confusion**: `{{ .Values.cmd }}` rendered as a string when the field expects a list. Use `toYaml` and proper indentation: `{{ toYaml .Values.cmd | nindent 8 }}`.
- **`nindent` vs `indent`**: `nindent` prefixes with a newline; `indent` does not. Pick the one that matches the surrounding YAML.
- **Whitespace from template tags**: `{{- ... -}}` chomps whitespace on each side. Without trims, empty conditionals leave blank lines that break YAML in subtle ways.
- **Missing `default`**: `image: {{ .Values.image.tag }}` becomes `image: null` if unset. Use `{{ .Values.image.tag | default .Chart.AppVersion }}`.
- **Hooks counted as release resources**: they are not. A hook Job that creates a Secret leaks unless you set `hook-delete-policy`.
- **`helm upgrade` with `--reset-values`**: silently drops `--set` overrides used at install time. Prefer `--reuse-values` or pass values explicitly each time.
- **Chart version not bumped**: shipping changes without bumping `Chart.yaml: version` makes OCI/registry consumers cache the old chart. Always bump on every release.
- **Secrets in `values.yaml`**: anyone with chart access reads them. Use external secret managers (External Secrets Operator, sealed-secrets) and reference by name.

## Reference
- Official docs: https://helm.sh/docs/
- Chart template guide: https://helm.sh/docs/chart_template_guide/
- Best practices: https://helm.sh/docs/chart_best_practices/

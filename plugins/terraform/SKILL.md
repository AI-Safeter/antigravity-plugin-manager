---
name: terraform
description: Write and review Terraform code for cloud infrastructure. Covers providers, resources, modules, remote state backends (S3, GCS, azurerm), variables and outputs, for_each and count, workspaces, drift detection, terraform import, and the plan/apply lifecycle. Use when authoring HCL, refactoring modules, fixing state issues, importing existing resources, or reviewing IaC changes.
---

# Terraform

Practical guide to writing maintainable Terraform 1.x code. Covers the lifecycle (`init`, `plan`, `apply`, `destroy`), modules, remote state, and the meta-arguments (`for_each`, `count`, `depends_on`, `lifecycle`) that account for most real-world pain.

## Use this skill when
- Writing or refactoring `.tf` files for AWS, GCP, Azure, or other providers
- Designing reusable modules with clean inputs and outputs
- Configuring an S3/GCS/azurerm remote state backend with locking
- Importing pre-existing cloud resources into Terraform state
- Diagnosing drift, state-lock errors, or `terraform plan` surprises
- Splitting a monolithic state into per-environment workspaces or directories

## Do not use this skill when
- You need procedural config management on a running host (use Ansible/Chef)
- You only need a one-off CLI call to a cloud API
- You are deploying Kubernetes workloads (use `kubernetes` or `helm-charts`)

## Core concepts
Terraform reconciles three things: HCL config (what you want), state (what it last knew), and the live cloud (what is actually there). `plan` diffs config vs state vs reality; `apply` makes reality match config and updates state. State is the source of truth for resource identity; losing it means re-importing every resource.

## Quick start
```hcl
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
  backend "s3" {
    bucket         = "my-tf-state"
    key            = "prod/network.tfstate"
    region         = "us-east-1"
    dynamodb_table = "tf-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region
}

variable "region" {
  type    = string
  default = "us-east-1"
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
  tags       = { Name = "main" }
}

output "vpc_id" {
  value = aws_vpc.main.id
}
```
```bash
terraform init       # download providers, configure backend
terraform plan -out=tfplan
terraform apply tfplan
```

## Key patterns

### Remote state with locking
Local state breaks the moment two engineers run apply. Always use a remote backend with locking:
- **S3 + DynamoDB**: `bucket`, `key`, `region`, `dynamodb_table` (for locks), `encrypt = true`
- **GCS**: native locking via object versioning
- **azurerm**: native lease-based locking on the blob

### Modules
Group related resources behind a clean interface.
```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.0"
  name    = "prod"
  cidr    = "10.0.0.0/16"
  azs     = ["us-east-1a", "us-east-1b"]
}
```
Pin `version`; never use `source = "git::..."` without a `?ref=` tag. Keep modules small: one logical concern, well-defined `variables.tf` and `outputs.tf`.

### for_each vs count
Prefer `for_each` over `count`. `count` indexes by integer; removing the second item renames all subsequent resources and triggers destroy/create.
```hcl
resource "aws_iam_user" "team" {
  for_each = toset(["alice", "bob", "carol"])
  name     = each.key
}
```
Use `count` only for boolean toggles: `count = var.enabled ? 1 : 0`.

### Variables and outputs
Type your variables, validate inputs, and avoid defaulting secrets.
```hcl
variable "instance_type" {
  type    = string
  default = "t3.small"
  validation {
    condition     = can(regex("^(t3|m5)\\.", var.instance_type))
    error_message = "Only t3.* or m5.* allowed."
  }
}
output "db_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = true
}
```

### Workspaces vs directories
Workspaces (`terraform workspace new staging`) share the same code with a separate state per workspace. Fine for ephemeral or near-identical envs. For prod/staging with diverging config, prefer separate directories (`envs/prod`, `envs/staging`) with their own backend keys.

### terraform import
Adopt existing resources without re-creating them:
```bash
terraform import aws_s3_bucket.logs my-existing-bucket
```
Or declaratively (Terraform 1.5+):
```hcl
import {
  to = aws_s3_bucket.logs
  id = "my-existing-bucket"
}
```
Then run `terraform plan -generate-config-out=generated.tf`.

### Lifecycle meta-argument
```hcl
resource "aws_db_instance" "main" {
  # ...
  lifecycle {
    prevent_destroy       = true
    create_before_destroy = true
    ignore_changes        = [tags["LastScanned"]]
  }
}
```

### Drift detection
`terraform plan` shows drift as in-place updates with no config change. Investigate before re-applying; someone may have made a manual change for a reason. Use `terraform refresh` (or `-refresh-only` plan) to sync state without changes.

## Common pitfalls
- **Editing state by hand**: `terraform.tfstate` is JSON but treating it as editable is a recipe for corruption. Use `terraform state mv`, `rm`, `import`.
- **Hardcoded secrets in `.tf` files**: anyone with repo access reads them, and they end up in state. Use a secrets manager and read via data sources, or pass via `TF_VAR_*` env.
- **No backend lock**: parallel applies overwrite each other's state. Always configure DynamoDB (S3) or use a backend with native locking.
- **`count` on a list that shrinks**: removing index 1 of 3 renames indexes 2 and 3, causing destroy/recreate. Use `for_each` with stable keys.
- **Provider version unpinned**: a new provider major version breaks the plan on a fresh `init`. Pin with `~>` in `required_providers`.
- **Implicit dependencies via strings**: `var.subnet_id = "subnet-abc"` instead of `aws_subnet.x.id` breaks the dependency graph. Reference the resource attribute so Terraform orders applies correctly.
- **`terraform destroy` in prod**: there is no undo. Use `prevent_destroy` lifecycle on critical resources and separate state per env.
- **Module versions floating**: `source = "./modules/vpc"` from a shared repo without a Git ref means a `git pull` quietly changes infra. Pin with `?ref=v1.2.3` or use the Registry with `version`.

## Reference
- Official docs: https://developer.hashicorp.com/terraform/docs
- Language reference: https://developer.hashicorp.com/terraform/language
- Registry: https://registry.terraform.io/

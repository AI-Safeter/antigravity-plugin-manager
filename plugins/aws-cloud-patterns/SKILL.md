---
name: aws-cloud-patterns
description: AWS architecture patterns covering IAM, VPC, S3, Lambda, RDS, SQS/SNS/EventBridge, CloudWatch, and IaC choices. Use when designing or reviewing AWS deployments, debugging permission errors, choosing between Lambda/ECS/Fargate, picking between CDK and Terraform, or controlling cloud spend.
---

# AWS Cloud Patterns

Practical patterns for building on AWS: how to scope IAM correctly, lay out a VPC that won't paint you into a corner, pick the right service for async work, and keep the bill from surprising you. Focused on the decisions that recur on real projects, not a service catalog.

## Use this skill when

- Designing IAM roles, policies, or cross-account access (assume-role, OIDC for CI)
- Picking between Lambda, ECS Fargate, and EC2 for a workload
- Building event-driven pipelines with SQS, SNS, or EventBridge
- Choosing data stores (S3 vs RDS vs DynamoDB) and access patterns
- Setting up CloudWatch logging, metrics, and alarms
- Deciding between CDK, Terraform, SAM, or raw CloudFormation
- Reviewing AWS spend and applying cost-control patterns

## Do not use this skill when

- You need vendor-neutral cloud architecture advice
- The question is GCP- or Azure-specific
- You only need a Lambda code snippet without architectural context

## Core concepts

- **IAM identities vs policies**: Identities are users, roles, and groups. Policies are JSON documents attached to identities (identity-based) or to resources like S3 buckets and KMS keys (resource-based). Effective permissions are the union, minus explicit denies and SCP/permission-boundary caps.
- **Roles, not users**: For workloads, use IAM roles assumed via STS. For humans, federate through IAM Identity Center (formerly AWS SSO) rather than long-lived IAM users. For CI, use OIDC federation (GitHub Actions, GitLab) instead of static keys.
- **Region and AZ**: Most services are regional. Some (IAM, CloudFront, Route 53, WAF for CloudFront) are global. An AZ is one or more datacenters; design across at least two for HA.
- **VPC primitives**: VPC has a CIDR. Subnets are AZ-scoped. Public subnets have a route to an Internet Gateway; private subnets reach the internet through a NAT Gateway. Security groups are stateful and instance-attached; NACLs are stateless and subnet-attached.
- **Event vs queue vs topic**: SQS is a pull queue with at-least-once delivery. SNS is fan-out pub/sub. EventBridge is a content-based router with schemas and rules across services and SaaS.

## Quick start

```bash
# Configure profile with SSO (preferred over static keys)
aws configure sso
aws sso login --profile dev

# Assume a role for a one-off task
aws sts assume-role \
 --role-arn arn:aws:iam::111122223333:role/DeployRole \
 --role-session-name local-deploy

# Tail Lambda logs
aws logs tail /aws/lambda/my-fn --follow --since 5m

# Generate a presigned S3 URL valid 15 minutes
aws s3 presign s3://my-bucket/report.pdf --expires-in 900
```

## Key patterns

### IAM least privilege

- Start from `Deny *`; grant the specific actions and resources a workload needs. Use Access Analyzer's policy generator to derive policies from CloudTrail history.
- Constrain with `Resource` ARNs and `Condition` keys (`aws:SourceVpce`, `aws:PrincipalOrgID`, `aws:SourceIp`). Wildcards in `Resource` are a code smell.
- Use permission boundaries on roles that developers can create, and SCPs at the org level to set non-negotiable guardrails (e.g., deny `iam:CreateUser`, deny outside approved regions).
- For cross-account access, the trust policy lives on the role being assumed, the permissions policy on the assuming principal.

### VPC layout

- One VPC per environment per region. CIDR /16 leaves room; do not overlap with on-prem or other VPCs you may peer.
- Three subnet tiers per AZ: public (ALB, NAT), private app, private data. Three AZs for production.
- NAT Gateways are billed per hour and per GB. One per AZ for HA; one shared NAT is a single point of failure but cheaper for dev.
- Prefer VPC endpoints (Gateway endpoints for S3 and DynamoDB; Interface endpoints for most other services) to keep traffic off the public internet and avoid NAT charges.

### S3 access

- Bucket policy controls cross-account and public access. IAM policy controls what an identity in your account can do. Both must allow; either can deny.
- Block Public Access at account and bucket level unless you explicitly need public objects. For website hosting, prefer CloudFront with OAC over a public bucket.
- For temporary download or upload by a client, generate a presigned URL or presigned POST. Set the shortest expiry that works.
- Enable default encryption (SSE-S3 or SSE-KMS), versioning for important data, and lifecycle rules to transition old objects to Infrequent Access or Glacier.

### Lambda

- Cold starts: dominated by package size and initialization. Keep deployment package small, move SDK clients and DB connections to module scope, and consider provisioned concurrency for latency-sensitive paths.
- Layers are for shared runtime dependencies, not for code reuse across functions you own (use a shared package instead).
- Environment variables are visible in the console; encrypt secrets with KMS or pull from Secrets Manager / Parameter Store at init.
- Concurrency: account-level cap is shared. Use reserved concurrency to protect downstreams; use provisioned concurrency to pre-warm.
- For long jobs (>15 min), heavy CPU, or sustained traffic, ECS Fargate or EKS is cheaper than Lambda.

### RDS and Aurora

- Multi-AZ for HA on RDS is a synchronous standby in another AZ; read replicas are async and separate. Aurora separates storage from compute and can read-replicate within seconds.
- Use IAM database authentication or Secrets Manager rotation for credentials, not static passwords in env vars.
- Connection storms from Lambda: use RDS Proxy or Aurora Serverless v2 to pool connections.
- Backups: automated snapshots are point-in-time within the retention window. Copy snapshots cross-region for DR.

### Async messaging

- SQS standard: at-least-once, high throughput, no ordering. SQS FIFO: exactly-once within a message group, lower throughput. Always set a dead-letter queue and a sensible `maxReceiveCount`.
- SNS for fan-out to multiple subscribers (SQS queues, Lambda, HTTP). Use SNS-to-SQS when subscribers process at different rates.
- EventBridge for cross-service and SaaS events with content-based routing, schemas, and replays. Custom buses isolate domains. Pipes connect a source (SQS, Kinesis, DynamoDB Streams) to a target with optional filter and transform.

### CloudWatch

- Logs: every Lambda and ECS task auto-ships to CloudWatch Logs. Set a retention policy on every log group (default is "never expire" and silently expensive).
- Metrics Insights and Logs Insights are the query languages for metrics and structured logs. Emit logs as JSON to make Insights queries cheap.
- Alarms on `Errors`, `Throttles`, and p99 `Duration` for Lambda; on `5XXError` and `TargetResponseTime` for ALB; on `CPUUtilization`, `FreeableMemory`, `DatabaseConnections` for RDS.
- For multi-account observability, ship logs to a central account via subscription filters or use CloudWatch cross-account observability.

### IaC: CDK vs Terraform vs SAM

- **CDK**: TypeScript/Python/Go that synthesizes CloudFormation. Best when the team is already in that language and wants reusable constructs. State lives in CloudFormation.
- **Terraform / OpenTofu**: multi-cloud, large provider ecosystem, explicit state file. Best when you span clouds or want fine-grained drift control. Prefer remote state with locking (S3 + DynamoDB or Terraform Cloud).
- **SAM**: thin layer over CloudFormation for serverless. Good for small Lambda-centric projects; outgrown quickly.
- Whichever you pick, keep one tool authoritative per resource. Mixing CDK and Terraform on the same resource leads to drift and weekend pages.

### Cost control

- Tag everything (`Project`, `Env`, `Owner`, `CostCenter`) and turn on Cost Allocation Tags. Without tags, AWS Cost Explorer can only group by service.
- The usual top spenders: NAT Gateway data processing, idle RDS, oversized EBS gp2 (move to gp3), under-utilized Fargate, CloudWatch Logs ingestion and retention, unattached EIPs, data transfer out.
- Savings Plans cover EC2, Fargate, and Lambda compute; Reserved Instances for RDS, ElastiCache, OpenSearch. Start with a 1-year No Upfront commitment at 70% of steady-state usage.
- S3 Intelligent-Tiering is a safe default for unknown access patterns; lifecycle to Glacier Deep Archive for compliance data.
- Set AWS Budgets with email alerts at 50/80/100% of expected monthly spend per account.

## Common pitfalls

- Granting `*` actions or `*` resources in IAM "just to unblock" and never tightening later. CloudTrail + Access Analyzer can derive a minimal policy.
- Putting Lambda in a VPC unnecessarily. Only do it when the function must reach private resources (RDS, internal ALB). VPC Lambdas have slower cold starts and need NAT for outbound internet.
- Forgetting log retention. A new account with default retention will quietly accrue thousands of dollars of CloudWatch Logs storage per year.
- Using the root account for daily work or storing root access keys. Lock root with hardware MFA and never create access keys for it.
- Single-AZ NAT in production. One AZ outage takes out egress for the whole VPC.
- Long-lived IAM user access keys for CI. Use OIDC federation from GitHub Actions or GitLab to a role.
- Tight coupling of services without a queue. Synchronous chains amplify failures; SQS between producer and consumer absorbs spikes and gives retries for free.

## Reference

- IAM policy reference and condition keys: docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies.html
- Well-Architected Framework pillars: aws.amazon.com/architecture/well-architected
- AWS Pricing Calculator: calculator.aws
- Service quotas: console -> Service Quotas (most can be raised by request)

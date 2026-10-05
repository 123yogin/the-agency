# mcp-cloud

Cloud and infrastructure, all read-only, reusing credentials you already have. No keys are asked for.

Off by default. Enable with `/plugin` > the-agency > mcp-cloud. Claude Code then asks for the keys below and stores secrets in your OS keychain.

**Prerequisites:** Node 20+, uv, Docker (terraform only).

| Server | What it gives you | Needs | Auth |
|---|---|---|---|
| supabase | Tables, migrations, logs, edge functions, type generation (read-only) | Supabase account | OAuth in the browser on first use (`/mcp` > supabase > Authenticate) |
| kubernetes | Pods, logs, events, resources across contexts (`--read-only`) | `~/.kube/config` | your kubeconfig |
| aws-api | Validated AWS CLI calls, `READ_OPERATIONS_ONLY=true` | AWS credentials | your default AWS profile / `AWS_PROFILE`; region from `AWS_REGION` (default us-east-1) |
| aws-knowledge | AWS docs, API references, regional availability | none | none |
| terraform | Live provider and module registry docs for correct HCL | Docker running | none |

Turn off any server you do not use: `/mcp`, select it, disable. Leave a key empty when Claude Code asks and the matching server simply fails to connect; nothing else is affected.

See mcp-core's README for tools that are better installed by hand.

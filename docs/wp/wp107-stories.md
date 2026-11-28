# WP107 · Beehiiv account audience

1. Mark new verified accounts and existing subscribers with a dedicated Beehiiv custom field. Keep separate confirmation, preserve unsubscribes and leave email sequences optional. Exercise the HTTP seam with mocked responses.
2. Provide a paginated, dry-run-first reconciliation for verified open accounts missing a job or stopped before any provider write. Validate reruns, suppression and account closure with Convex tests.

3. During the owner’s email hold, match each verified signup immediately. Update the audience field and subscriber tag for existing active or pending contacts. Keep missing addresses in Convex for later reconciliation. The silent worker must have no subscription-create or journey path, including when an automation ID remains configured.

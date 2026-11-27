import { ZodError } from "zod";
import { generateInput, type LandingPageId } from "./blocks";
import { isSameOrigin, privateJson, privateNotFound } from "./http";
import { generateProposal, ProposalRejected, type Model } from "./proposal";

type Dependencies = {
  authorised: () => Promise<boolean>;
  limit: () => number;
  model: () => Model | null;
  read: (id: LandingPageId) => Promise<unknown>;
};

export async function handleGenerate(request: Request, dependencies: Dependencies) {
  if (!(await dependencies.authorised())) return privateNotFound();
  if (!isSameOrigin(request)) return privateJson({ error: "Use the signed-in page editor to generate a preview." }, 403);
  const model = dependencies.model();
  if (!model) return privateJson({ error: "Enhance is unavailable until an Anthropic key is configured." }, 503);
  let input;
  try {
    input = generateInput.parse(await request.json());
  } catch {
    return privateJson({ error: "Select a valid page, section and action." }, 400);
  }
  const retryAfter = dependencies.limit();
  if (retryAfter) return privateJson({ error: "Too many previews. Try again shortly." }, 429, { "Retry-After": String(retryAfter) });
  try {
    return privateJson(await generateProposal(input, { model, read: dependencies.read }));
  } catch (error) {
    if (error instanceof ProposalRejected) return privateJson({ error: error.message }, 422);
    if (error instanceof ZodError) return privateJson({ error: "The proposed copy did not match the section format." }, 422);
    return privateJson({ error: "The preview could not be generated. Try again." }, 502);
  }
}

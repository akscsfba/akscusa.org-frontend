import {
  shortLinkRules,
  type ShortLink,
} from "~/features/short-links/redirects";
import { byId, loadPublished } from "~/lib/collections";

export async function loadShortLinks(): Promise<ShortLink[]> {
  const entries = await loadPublished("shortLinks", byId);
  const links = entries.map(({ id, data }) => ({
    code: id,
    destination: data.destination,
  }));
  shortLinkRules(links);
  return links;
}

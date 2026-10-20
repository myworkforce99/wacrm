/**
 * Meta Graph API helpers for Instagram Content Publishing and
 * Facebook Page Posts.
 *
 * Wraps the Graph API v21.0 endpoints used for social posting.
 * All calls are server-side only (API routes) — never import
 * this module from client components.
 *
 * Endpoint reference:
 *   Instagram: POST /{ig-user-id}/media  → /{ig-user-id}/media_publish
 *   Facebook:  POST /{page-id}/photos or /{page-id}/feed
 */

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface PublishImageResult {
  success: boolean;
  platform_post_id?: string;
  error?: string;
}

/**
 * Publishes a single-image post to an Instagram Business account.
 * Instagram requires a two-step flow:
 *   1. Create a media container (returns a container ID).
 *   2. Publish the container (returns the final media ID).
 */
export async function publishInstagramPost(params: {
  igUserId: string;
  accessToken: string;
  imageUrl: string; // Must be a publicly reachable URL
  caption?: string;
}): Promise<PublishImageResult> {
  try {
    // Step 1: Create container
    const containerRes = await fetch(`${GRAPH_BASE}/${params.igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: params.imageUrl,
        caption: params.caption ?? '',
        access_token: params.accessToken,
      }),
    });
    const containerData = (await containerRes.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (!containerRes.ok || !containerData.id) {
      return {
        success: false,
        error: containerData.error?.message ?? 'Container creation failed',
      };
    }

    // Step 2: Publish container
    const publishRes = await fetch(
      `${GRAPH_BASE}/${params.igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: params.accessToken,
        }),
      }
    );
    const publishData = (await publishRes.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (!publishRes.ok || !publishData.id) {
      return {
        success: false,
        error: publishData.error?.message ?? 'Publish failed',
      };
    }
    return { success: true, platform_post_id: publishData.id };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'Network error during publish',
    };
  }
}

/**
 * Publishes a photo post to a Facebook Page.
 */
export async function publishFacebookPost(params: {
  pageId: string;
  accessToken: string;
  imageUrl: string;
  caption?: string;
}): Promise<PublishImageResult> {
  try {
    const res = await fetch(`${GRAPH_BASE}/${params.pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: params.imageUrl,
        message: params.caption ?? '',
        access_token: params.accessToken,
      }),
    });
    const data = (await res.json()) as {
      post_id?: string;
      id?: string;
      error?: { message?: string };
    };
    const postId = data.post_id ?? data.id;
    if (!res.ok || !postId) {
      return {
        success: false,
        error: data.error?.message ?? 'Publish failed',
      };
    }
    return { success: true, platform_post_id: postId };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : 'Network error during publish',
    };
  }
}

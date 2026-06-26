import container from '../di/container.js';
import { IOAuthRepo } from './repo.js';
import { IClientRegistrationRepo } from './client-repo.js';
import { getProviderConfig } from './providers.js';
import * as oauthClient from './oauth-client.js';
import { OAuthTokens } from './types.js';

let refreshInFlight: Promise<OAuthTokens> | null = null;

async function performRefresh(tokens: OAuthTokens): Promise<OAuthTokens> {
    console.log("Refreshing jobraker-recruiter access token");
    if (!tokens.refresh_token) {
        throw new Error('Jobraker Recruiter token expired and no refresh token available. Please sign in again.');
    }

    const providerConfig = await getProviderConfig('jobraker-recruiter');
    if (providerConfig.discovery.mode !== 'issuer') {
        throw new Error('Jobraker Recruiter provider requires issuer discovery mode');
    }

    const clientRepo = container.resolve<IClientRegistrationRepo>('clientRegistrationRepo');
    const registration = await clientRepo.getClientRegistration('jobraker-recruiter');
    if (!registration) {
        throw new Error('Jobraker Recruiter client not registered. Please sign in again.');
    }

    const config = await oauthClient.discoverConfiguration(
        providerConfig.discovery.issuer,
        registration.client_id,
    );

    const refreshed = await oauthClient.refreshTokens(
        config,
        tokens.refresh_token,
        tokens.scopes,
    );

    const oauthRepo = container.resolve<IOAuthRepo>('oauthRepo');
    await oauthRepo.upsert('jobraker-recruiter', { tokens: refreshed });

    return refreshed;
}

export async function getAccessToken(): Promise<string> {
    const oauthRepo = container.resolve<IOAuthRepo>('oauthRepo');
    const { tokens } = await oauthRepo.read('jobraker-recruiter');
    if (!tokens) {
        throw new Error('Not signed into Jobraker Recruiter');
    }

    if (!oauthClient.isTokenExpired(tokens)) {
        return tokens.access_token;
    }

    if (!refreshInFlight) {
        refreshInFlight = performRefresh(tokens).finally(() => {
            refreshInFlight = null;
        });
    }
    const refreshed = await refreshInFlight;
    return refreshed.access_token;
}

# RAD Timer

GPS Race Timing app for iOS and Android. Create a race, share a QR code, and let anyone track their run with automatic start/finish detection.

## Quick Start

### Mobile App (Expo)

```bash
npm install
npx expo start
```

### Backend

```bash
cd backend
npm install
npx serverless deploy --region us-west-2
```

## Architecture

- **Mobile:** React Native + Expo (Expo Router, Expo Location, Expo Camera)
- **Backend:** AWS Lambda + API Gateway + DynamoDB + S3
- **Website:** S3 + CloudFront (radtimer.com)
- **GPS Processing:** turf.js for line-crossing detection

## API (api.radtimer.com)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /races | Create a race session |
| GET | /races/{id} | Get race details |
| POST | /races/{id}/upload | Upload GPS track |
| GET | /races/{id}/leaderboard | Get sorted results |

## DNS Records Required

| Type | Name | Value |
|------|------|-------|
| CNAME | `_69b1e643a3dd6c67233ed6fc40454d58.radtimer.com` | `_e162d42f5c9411f0e5bcd15d3ffcb13b.jkddzztszm.acm-validations.aws.` |
| CNAME | `_56f041f1a74f2dc7dfa9f4742f860f6a.api.radtimer.com` | `_3579c581f32fba4cd778c797046eece5.jkddzztszm.acm-validations.aws.` |
| A/ALIAS | `radtimer.com` | `d3m6tk6ljjlwzt.cloudfront.net` |
| CNAME | `api.radtimer.com` | (API Gateway custom domain - set up after cert validates) |

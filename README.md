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

## Infrastructure

DNS is managed via AWS Route 53 (hosted zone `Z02956751W1LYFYLKLXID`).

| Domain | Service |
|--------|---------|
| `radtimer.com` | CloudFront (`E35GFF9OSJTPGS`) -> S3 static site |
| `api.radtimer.com` | API Gateway (`x0ioz5uedl`) -> Lambda functions |

Nameservers (set at registrar):
- `ns-1143.awsdns-14.org`
- `ns-413.awsdns-51.com`
- `ns-572.awsdns-07.net`
- `ns-1573.awsdns-04.co.uk`

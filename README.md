# Agency desk

A local Next.js dashboard for an OnlyFans agency using Infloww's read-only API. It covers the creators and employees available to the supplied key.

## Run locally

Requires Node.js 22 or newer. The local scripts listen on the loopback address. Development opens directly when a dashboard password is unset. Production requires authentication.

```sh
npm ci
cp .env.example .env.local # Skip if .env.local already exists
```

Set `INFLOWW_API_KEY` and `INFLOWW_AGENCY_OID` in `.env.local`, then run `npm run dev` and open http://127.0.0.1:3000. Both credentials stay on the server. An uncached report takes time to page through Infloww. The first 90-day report can take roughly a minute.

## Hosted access

Configure `INFLOWW_API_KEY`, `INFLOWW_AGENCY_OID` and a high-entropy `DASHBOARD_PASSWORD` as production secrets. Use HTTPS and sign in with username `agency` and the dashboard password. The password protects the dashboard, report API and refresh requests. Production returns an error until a password is configured.

## Reporting rules

| Metric | Definition |
| --- | --- |
| Net earnings | USD net from settled transactions after platform fees and before separate refund adjustments. Compared with the immediately preceding period of equal length. |
| New subscribers | Daily new subscriber counts summed across connected creator profiles. |
| Active fans | End-of-period snapshot across connected creator profiles. One fan can appear on multiple profiles. |
| Chatter sales | Employee-attributed sales reported by Infloww. This figure overlaps with creator earnings. |
| Fan chats | Sum of daily employee-and-creator fan counts. A fan can be counted on multiple days or in multiple profiles. |
| PPV unlock rate | Total reported PPV unlocks divided by direct PPVs sent. A dash indicates the rate is unavailable. |
| Promotions | Tracking links, free trials and profile promotions created during the selected dates, with cumulative link metrics. Free-trial subscriber counts represent trial claims. |

The period picker uses complete UTC days. Report synchronization can lag at the source. A dash means a value is unavailable, and a report warning identifies partial coverage. Successful snapshots are cached in memory for up to two minutes.

Data comes from Infloww's connected creators, transactions, fan status, new and renewed fans, employees, employee sales and chat statistics, and links endpoints. Requests use GET with the raw key in `Authorization` and the agency OID in `x-oid`. [Infloww API documentation](https://infloww-openapi.stoplight.io/docs/openapi/wnttpt5i2x0gz-infloww-api)

## Verify

```sh
npm test
npm run typecheck
npm run build
```

# Why Two Phones Can Show Different Times (rad vs rob)

When you run the same test with two phones (e.g. "rad" and "rob") at the same time, the reported times often differ by a few seconds even though you crossed the same start and finish lines. Here’s why and how to get closer results.

## How We Compute Time

1. **GPS points**  
   Each phone records position at its own moments (e.g. every 250 ms or every 0.5 m).  
   Each point has: `lat`, `lng`, `timestamp` (from the device/GPS).

2. **Crossing detection**  
   We find the **first** segment between two consecutive points that crosses the start line, then the **first** segment that crosses the finish line (after the start).

3. **Interpolated time**  
   We don’t use the raw point time. We interpolate:
   - Where the segment crosses the line (between point A and point B).
   - `crossTime = time_A + (distance from A to cross) / (distance A to B) * (time_B - time_A)`.

So the reported time is the **interpolated** moment of crossing, not the time of the nearest raw point.

## Why rad and rob Differ

- **Different sample times**  
  Phone “rad” might have points at 10.00 s and 10.25 s and cross at 10.10 s.  
  Phone “rob” might have points at 10.05 s and 10.30 s and cross at 10.12 s.  
  So start (and similarly finish) can differ by a fraction of the sampling interval on each device.

- **Different paths**  
  Even with both phones on you, GPS drift and filtering can differ slightly. That can change which segment is “first” to cross and where the intersection is, so the interpolated time shifts.

- **Start/stop not synced**  
  If “Start tracking” was tapped at different times on the two phones, the whole timeline is shifted by that offset. Same idea if one phone had a delay before the first fix.

So differences of **about 0.5–2 seconds** between the two phones are normal and come from:
- Sampling (interval and phase),
- Slightly different crossing geometry,
- Possible small offset in when tracking started.

## GPS Sampling: Standard vs High

- **Standard (default)**  
  **1-second (1 Hz)** sampling (Strava-style): `timeInterval: 1000` ms, `distanceInterval: 1` m. Best battery; times between two phones often within ~1 s.

- **High (race director option)**  
  When creating a race, the director can choose **High** GPS accuracy: **¼-second** sampling (`timeInterval: 250` ms, `distanceInterval: 0.5` m). Use for short races when you want the most accurate times; **drains battery faster** (roughly 2–4× more than standard for the GPS part).

The backend always interpolates crossing time between the two points that bracket the line, so reported time is sub-second either way.

## How to Run a Fair Two-Phone Test

1. **Same start**  
   Start tracking on both phones as close together as possible (e.g. “3, 2, 1, tap both”).

2. **Same path**  
   Keep both phones on you and take the same path through start and finish (avoid weaving; cross the lines clearly).

3. **Clear crossing**  
   Cross start and finish as close to perpendicular as you can so the crossing segment is short and interpolation is more stable.

4. **Same race**  
   Use the same race (same start/finish lines) for both; join as “rad” and “rob” and run the same test twice (rad 1 / rob 1, then rad 2 / rob 2).

5. **Interpret results**  
   After the change above, rad vs rob will often be within **about 0.5–1 s**. If one phone is consistently 2+ seconds different, check:
   - Did one phone start tracking later?
   - Is one phone in a pocket or bag with worse GPS (e.g. more drift)?

## Checking Your rad 1 / rob 1 and rad 2 / rob 2 Results

We don’t have access to your AWS data or the uploaded GPS files (raw tracks are removed after processing). To compare:

1. **Leaderboard**  
   Note the exact times for rad 1, rob 1, rad 2, rob 2 (and any other attempts).

2. **Pattern**  
   - If one phone is always faster or slower by a similar amount (e.g. rob always ~1 s less), it’s likely a combination of sampling and when you tapped “Start” on each phone.
   - If the difference changes a lot between runs, it’s more likely sampling/geometry (which the 250 ms / 0.5 m change should help).

3. **Next test**  
   For closer times, create the race with **High** GPS accuracy (or use Standard and accept ~1 s variance). Run the same two-phone test and compare rad vs rob.

---

## Other Causes of Times Off by Many Seconds (Besides GPS Sampling)

Besides GPS sample rate, these can push two devices’ times apart by several seconds:

### 1. **Timestamp source (device vs GPS)**

We use `loc.timestamp` from the location API when present; if missing we fall back to `Date.now()`.  
- **GPS timestamp** is from the satellite fix (effectively UTC); two phones should agree within a small error.  
- **Date.now()** is the device’s system clock. If one phone’s clock is wrong by 5+ seconds (e.g. not synced), that device’s times will be shifted.  
**Fix:** Prefer GPS time. The app uses the platform’s location timestamp; avoid falling back to device time for timing if possible.

### 2. **Timestamp units (seconds vs milliseconds)**

If timestamps were ever interpreted as seconds on one path and milliseconds on another, you’d see 1000× errors (e.g. 90 s vs 90,000 ms).  
**In our code:** We treat timestamps as **milliseconds** everywhere (Expo Location typically gives ms since epoch). No conversion to seconds for crossing math.

### 3. **Wrong crossing (noise or loops)**

We use the **first** crossing of the start line and the **first** crossing of the finish line after that.  
- **GPS jitter:** A spike can make the track “cross” the line and back; we still take the first crossing, but the interpolated time can jump by a second if the next real crossing is used on the other device.  
- **Loop backs:** If the path crosses the start line again later, we don’t use that. So this usually doesn’t add many seconds unless the path is very irregular.  
**Mitigation:** Cross the line clearly; avoid weaving. High GPS sampling reduces how much one bad point affects the bracket.

### 4. **Start tracking at different times**

When you tap “Start tracking” doesn’t change the **elapsed** time we compute (we use first start-line crossing to first finish-line crossing). So a 5 s delay on one phone doesn’t make that phone’s elapsed time 5 s less.  
It can still matter if one phone has no or few points before the start line (e.g. started too late and missed the start). So both phones should be recording before you cross the start.

### 5. **Race definition (line placement)**

If the start or finish line is in a different place for different participants (e.g. two races), times won’t match. For the same race, everyone shares the same lines; no extra error from this.

### 6. **Backend rounding**

We use `Math.round(finishCrossing.timestamp - startCrossing.timestamp)` (milliseconds). So we round to the nearest ms; that’s not a source of multi-second errors.

**Summary:** For differences of **many** seconds, the most likely causes are (1) one device using a wrong or unsynced clock (if we ever used device time), (2) one device having very few or noisy points so the “first” crossing is wrong, or (3) different races/lines. For typical 1–2 s differences, GPS sampling and crossing interpolation explain it; use **High** GPS when the race director wants the best accuracy for short races.

---

## Timing debug and flags on the leaderboard

To compare runs and spot mismatched settings or fallbacks:

- **Timing debug**  
  Each result can show **Start** and **End** timestamps (HH:mm:ss.SSS) from the crossing detector. Use these to compare two devices on the same run (e.g. rad 1 vs rob 1): the start/end times should be close if both used GPS time and similar sampling.

- **"High GPS" badge**  
  Shown when that result was recorded with the race's **High** GPS setting (¼ s sampling). Compare results: if one has "High GPS" and another doesn't, they used different sampling and small time differences are expected.

- **"⚠ device time" badge and flagged time**  
  Shown when any GPS point used the **device time fallback** instead of the GPS timestamp (e.g. platform didn't provide `loc.timestamp`). The elapsed time is shown in a warning color with a "may vary" hint. Treat these results as less comparable across devices; fix device/OS so the app gets GPS timestamps.

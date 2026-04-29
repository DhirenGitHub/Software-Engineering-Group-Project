import numpy as np
from collections import deque


class TrackedObject:
    def __init__(self, track_id, bbox, centroid):
        self.id = track_id
        self.bbox = bbox
        self.centroid = centroid

        self.area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1])
        self.history = deque(maxlen=200)  # must hold at least LOITER_TIME_FRAMES (150) entries
        self.history.append(centroid)

        # Stores the last 3 speed calculations for median filtering.
        # Smaller window = faster response to sudden speed changes (e.g. walking → sprinting).
        self.speed_buffer = deque(maxlen=3)

        self.speed = 0.0
        self.is_anomalous = False
        self.anomaly_label = None

        self.run_streak = 0
        self.age = 0

    def update(self, new_bbox, new_centroid):
        self.age += 1

        # 1. Physics Filter (Vertical Bobbing)
        dx = new_centroid[0] - self.centroid[0]
        dy = (new_centroid[1] - self.centroid[1]) * 0.5
        instant_speed = np.sqrt(dx ** 2 + dy ** 2)

        # 2. Shape Stability
        new_area = (new_bbox[2] - new_bbox[0]) * (new_bbox[3] - new_bbox[1])
        if self.area > 0:
            area_change = abs(new_area - self.area) / self.area
        else:
            area_change = 0

        # Glitch Filters
        # 0.7 threshold: only zero out speed on extreme bbox size jumps (tracker ID swap).
        # The old 0.4 threshold was firing on normal running posture changes.
        if area_change > 0.7:
            instant_speed = 0.0
        # NOTE: The old "elif instant_speed > 20: instant_speed = self.speed" was the main bug.
        # It replaced legitimate sprinting speeds (often >20 px/frame) with the previous
        # walking speed, so fast runners were NEVER recorded as fast. Removed entirely.
        if self.age < 5: instant_speed = 0.0

        # --- THE FIX: MEDIAN FILTER ---
        # Add the new speed to the buffer
        self.speed_buffer.append(instant_speed)

        # If we have enough data, take the Median (Middle Value)
        if len(self.speed_buffer) >= 3:
            self.speed = float(np.median(self.speed_buffer))
        else:
            # Not enough data yet, just take the average
            self.speed = float(np.mean(self.speed_buffer))

        # Update State
        self.bbox = new_bbox
        self.centroid = new_centroid
        self.area = new_area
        self.history.append(new_centroid)
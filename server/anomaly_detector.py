import numpy as np


class AnomalyDetector:
    def __init__(self):
        # 8.0: comfortably above normal walking (~4-6 px/frame) but below running (~10-18+).
        self.RUNNING_THRESHOLD = 8.0

        # Require 5 consecutive frames above threshold before flagging.
        # Walking can briefly spike for 1-3 frames; genuine running sustains 5+ frames easily.
        self.MIN_RUN_FRAMES = 5

        # Once PANIC is triggered, keep the flag for this many frames even if speed
        # temporarily dips (e.g. between strides, brief occlusion). Prevents flickering.
        self.PANIC_COOLDOWN = 15

        self.LOITER_TIME_FRAMES = 150
        self.LOITER_DIST_LIMIT = 50.0

        # Per-object cooldown counters {obj_id: frames_remaining}
        self._panic_cooldown = {}

    def process(self, tracked_objects):
        for obj_id, obj in tracked_objects.items():

            if obj_id not in self._panic_cooldown:
                self._panic_cooldown[obj_id] = 0

            # --- 1. CHECK SPEED STREAK ---
            if obj.speed > self.RUNNING_THRESHOLD:
                obj.run_streak += 1
            else:
                obj.run_streak = 0

            # --- 2. PRIORITY: PANIC ---
            if obj.run_streak >= self.MIN_RUN_FRAMES:
                obj.is_anomalous = True
                obj.anomaly_label = "PANIC"
                self._panic_cooldown[obj_id] = self.PANIC_COOLDOWN

            # --- 2b. PANIC COOLDOWN: keep flag after speed drops ---
            elif self._panic_cooldown[obj_id] > 0:
                self._panic_cooldown[obj_id] -= 1
                obj.is_anomalous = True
                obj.anomaly_label = "PANIC"

            # --- 3. PRIORITY: LOITERING ---
            elif len(obj.history) >= self.LOITER_TIME_FRAMES:
                start_pos = obj.history[0]
                curr_pos = obj.history[-1]
                dist_moved = np.sqrt((curr_pos[0] - start_pos[0]) ** 2 + (curr_pos[1] - start_pos[1]) ** 2)

                if dist_moved < self.LOITER_DIST_LIMIT:
                    obj.is_anomalous = True
                    obj.anomaly_label = "LOITERING"
                else:
                    if obj.anomaly_label == "LOITERING":
                        obj.is_anomalous = False
                        obj.anomaly_label = None

            # --- RESET ---
            else:
                obj.is_anomalous = False
                obj.anomaly_label = None

        # Clean up cooldown state for objects that are no longer tracked
        stale_ids = [k for k in self._panic_cooldown if k not in tracked_objects]
        for k in stale_ids:
            del self._panic_cooldown[k]
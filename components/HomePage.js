import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Platform,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from 'axios';

// Import the notification helper and thresholds from Setting
import { checkAndNotify, DEFAULT_THRESHOLDS } from './Setting';

// ─── Config ───────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL = 5000;

const SENSORS = [
  { key: 'airTemp',    label: 'Air Temp',    unit: '°C',  icon: '🌡️', color: '#FF6B6B', bg: '#FFF0F0' },
  { key: 'humidity',   label: 'Humidity',    unit: '%',   icon: '💧', color: '#4ECDC4', bg: '#F0FFFE' },
  { key: 'waterTemp',  label: 'Water Temp',  unit: '°C',  icon: '🌊', color: '#45B7D1', bg: '#F0F8FF' },
  { key: 'waterLevel', label: 'Water Level', unit: 'cm',  icon: '📏', color: '#96CEB4', bg: '#F0FFF4' },
  { key: 'pH',         label: 'pH Level',    unit: 'pH',  icon: '🧪', color: '#C39BD3', bg: '#FAF0FF' },
  { key: 'TDS',        label: 'TDS',         unit: 'ppm', icon: '⚗️', color: '#F0B27A', bg: '#FFF8F0' },
];

const formatTimestamp = (ts) => {
  const parts = ts.split('_');
  if (parts.length >= 6) {
    return `${parts[0]}-${parts[1]}-${parts[2]}  ${parts[3]}:${parts[4]}:${parts[5]}`;
  }
  return ts;
};

// ─── Pulse dot ────────────────────────────────────────────────────────────────
const PulseDot = ({ color = '#4ECDC4' }) => {
  const scale   = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1.8, duration: 700, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,   duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: 14, height: 14,
        borderRadius: 7, backgroundColor: color,
        transform: [{ scale }], opacity,
      }} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
    </View>
  );
};

// ─── Threshold status indicator ───────────────────────────────────────────────
// Shows a small colored pill on the card if value is out of range
const ThresholdPill = ({ sensorKey, value, thresholds }) => {
  if (value === undefined || value === null) return null;
  const limit = thresholds?.[sensorKey];
  if (!limit) return null;

  const num = Number(value);
  const tooLow  = limit.min !== null && limit.min !== undefined && num < limit.min;
  const tooHigh = limit.max !== null && limit.max !== undefined && num > limit.max;

  if (!tooLow && !tooHigh) {
    return (
      <View style={[styles.pill, { backgroundColor: '#E8F8F0', borderColor: '#27AE60' }]}>
        <Text style={[styles.pillTxt, { color: '#27AE60' }]}>✓ OK</Text>
      </View>
    );
  }
  return (
    <View style={[styles.pill, { backgroundColor: '#FFF0F0', borderColor: '#E74C3C' }]}>
      <Text style={[styles.pillTxt, { color: '#E74C3C' }]}>
        {tooLow ? '▼ LOW' : '▲ HIGH'}
      </Text>
    </View>
  );
};

// ─── Data card ────────────────────────────────────────────────────────────────
const DataCard = ({ sensor, value, prevValue, index, thresholds }) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, delay: index * 80, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: index * 80, useNativeDriver: true }),
    ]).start();
  }, []);

  // Flash on value change
  const prevValueRef = useRef(prevValue);
  useEffect(() => {
    if (prevValueRef.current !== null && prevValueRef.current !== value && value !== undefined) {
      Animated.sequence([
        Animated.timing(flashAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        Animated.timing(flashAnim, { toValue: 0, duration: 800, useNativeDriver: false }),
      ]).start();
    }
    prevValueRef.current = prevValue;
  }, [value]);

  const flashBg = flashAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['rgba(0,0,0,0)', sensor.color + '50'],
  });

  const changed   = prevValue !== null && prevValue !== undefined && prevValue !== value;
  const increased = changed && Number(value) > Number(prevValue);

  // Check if value is out of threshold range for card border highlight
  const limit = thresholds?.[sensor.key];
  const num   = Number(value);
  const outOfRange = limit && value !== undefined && (
    (limit.min !== null && limit.min !== undefined && num < limit.min) ||
    (limit.max !== null && limit.max !== undefined && num > limit.max)
  );

  return (
    <Animated.View style={[
      styles.card,
      {
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        backgroundColor: sensor.bg,
        borderLeftColor: outOfRange ? '#E74C3C' : sensor.color,
        borderLeftWidth: outOfRange ? 5 : 4,
      },
    ]}>
      <Animated.View style={[StyleSheet.absoluteFillObject, { backgroundColor: flashBg, borderRadius: 16 }]} />

      <View style={styles.cardTop}>
        <Text style={styles.cardIcon}>{sensor.icon}</Text>
        <Text style={[styles.cardLabel, { color: sensor.color }]}>{sensor.label}</Text>
        {changed && (
          <Text style={[styles.changeBadge, { color: increased ? '#27AE60' : '#E74C3C' }]}>
            {increased ? '▲' : '▼'}
          </Text>
        )}
      </View>

      <View style={styles.cardValueRow}>
        <Text style={[styles.cardValue, { color: outOfRange ? '#E74C3C' : '#1A252F' }]}>
          {value !== undefined && value !== null ? Number(value).toFixed(1) : '--'}
        </Text>
        <Text style={[styles.cardUnit, { color: sensor.color }]}>{sensor.unit}</Text>
      </View>

      {changed && (
        <Text style={styles.prevValue}>
          was {Number(prevValue).toFixed(1)} {sensor.unit}
        </Text>
      )}

      {/* Threshold safe range label */}
      {limit && (
        <Text style={styles.rangeLabel}>
          Safe: {limit.min ?? '—'} – {limit.max ?? '∞'} {sensor.unit}
        </Text>
      )}

      {/* OK / LOW / HIGH pill */}
      <ThresholdPill sensorKey={sensor.key} value={value} thresholds={thresholds} />

      <View style={[styles.cardBar, { backgroundColor: sensor.color + '20' }]}>
        <View style={[styles.cardBarFill, { backgroundColor: outOfRange ? '#E74C3C' : sensor.color, width: '70%' }]} />
      </View>
    </Animated.View>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
// Props: thresholds (from App.js), alertsEnabled (optional, defaults true)
const HomePage = ({ thresholds, alertsEnabled = true }) => {
  const [currentData, setCurrentData] = useState(null);
  const [prevData,    setPrevData]    = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState(null);
  const [countdown,   setCountdown]   = useState(0);
  const [fetchCount,  setFetchCount]  = useState(0);
  const [isLive,      setIsLive]      = useState(true);

  const countdownRef = useRef(null);
  const fetchRef     = useRef(null);
  const liveStartRef = useRef(Date.now());

  // Use passed-in thresholds, or fall back to defaults
  const activeThresholds = thresholds ?? Object.fromEntries(
    Object.entries(DEFAULT_THRESHOLDS).map(([k, v]) => [k, { min: v.min, max: v.max }])
  );

  const API_URL = Platform.OS === 'android'
    ? 'http://10.0.2.2:5000/getdata'
    : 'http://localhost:5000/getdata';

  const fetchData = useCallback(async (isManual = false) => {
    try {
      setError(null);
      if (isManual) setRefreshing(true);

      const response = await axios.get(API_URL);
      const data = response.data;
      const timestamps = Object.keys(data).sort();
      const latestTimestamp = timestamps[timestamps.length - 1];

      if (latestTimestamp) {
        const latestReading = data[latestTimestamp];

        // ── Check every sensor against thresholds and fire notifications ──
        const sensorKeys = Object.keys(DEFAULT_THRESHOLDS);
        await Promise.all(
          sensorKeys.map((key) =>
            checkAndNotify(key, latestReading[key], activeThresholds, alertsEnabled)
          )
        );

        setCurrentData(old => { setPrevData(old); return latestReading; });
        setLastUpdated(formatTimestamp(latestTimestamp));
        setFetchCount(c => c + 1);
      }
    } catch (err) {
      setError('Cannot reach server. Is it running?');
      console.error('Fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_URL, activeThresholds, alertsEnabled]);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (!isLive) {
      clearInterval(fetchRef.current);
      clearInterval(countdownRef.current);
      setCountdown(0);
      return;
    }
    liveStartRef.current = Date.now();
    countdownRef.current = setInterval(() => {
      const elapsed = (Date.now() - liveStartRef.current) % REFRESH_INTERVAL;
      setCountdown(elapsed / REFRESH_INTERVAL);
    }, 150);
    fetchRef.current = setInterval(() => fetchData(), REFRESH_INTERVAL);
    return () => {
      clearInterval(fetchRef.current);
      clearInterval(countdownRef.current);
    };
  }, [isLive, fetchData]);

  const onRefresh = useCallback(() => {
    liveStartRef.current = Date.now();
    fetchData(true);
  }, [fetchData]);

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#45B7D1" />
        <Text style={styles.loadingText}>Connecting to sensors…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#45B7D1" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Hydro Monitor</Text>
            <Text style={styles.headerSub}>
              {lastUpdated ? `Updated: ${lastUpdated}` : 'Waiting for data…'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.liveBtn, {
              borderColor: isLive ? '#4ECDC4' : '#E74C3C',
              backgroundColor: isLive ? '#E8FBF8' : '#FFF0F0',
            }]}
            onPress={() => setIsLive(v => !v)}
          >
            {isLive
              ? <PulseDot color="#4ECDC4" />
              : <View style={[styles.dot, { backgroundColor: '#E74C3C' }]} />
            }
            <Text style={[styles.liveBtnText, { color: isLive ? '#4ECDC4' : '#E74C3C' }]}>
              {isLive ? 'LIVE' : 'PAUSED'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status bar */}
        <View style={styles.statusBar}>
          <View style={styles.statusItem}>
            <Text style={styles.statusVal}>{fetchCount}</Text>
            <Text style={styles.statusLbl}>POLLS</Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={styles.statusItem}>
            <Text style={styles.statusVal}>{REFRESH_INTERVAL / 1000}s</Text>
            <Text style={styles.statusLbl}>INTERVAL</Text>
          </View>
          <View style={styles.statusDivider} />
          <View style={[styles.statusItem, { flex: 2, paddingHorizontal: 8 }]}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${countdown * 100}%` }]} />
            </View>
            <Text style={styles.statusLbl}>NEXT REFRESH</Text>
          </View>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData(true)}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Grid */}
        {!error && (
          <View style={styles.grid}>
            {SENSORS.map((sensor, i) => (
              <DataCard
                key={sensor.key}
                sensor={sensor}
                value={currentData?.[sensor.key]}
                prevValue={prevData?.[sensor.key] ?? null}
                index={i}
                thresholds={activeThresholds}
              />
            ))}
          </View>
        )}

        <Text style={styles.footer}>Pull to refresh  •  Tap LIVE to pause auto-refresh</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HomePage;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },

  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4F8' },
  loadingText:   { marginTop: 12, fontSize: 15, color: '#7F8C8D', fontWeight: '500' },

  scroll: { padding: 16, paddingBottom: 36 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#1A252F', letterSpacing: -0.5 },
  headerSub:   { fontSize: 11, color: '#95A5A6', marginTop: 3 },

  liveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
  },
  liveBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  dot:         { width: 8, height: 8, borderRadius: 4 },

  statusBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 14,
    padding: 12, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  statusItem:    { flex: 1, alignItems: 'center' },
  statusVal:     { fontSize: 17, fontWeight: '800', color: '#2C3E50' },
  statusLbl:     { fontSize: 9, color: '#95A5A6', marginTop: 3, letterSpacing: 0.8, fontWeight: '600' },
  statusDivider: { width: 1, height: 32, backgroundColor: '#ECF0F1', marginHorizontal: 4 },
  progressTrack: { width: '100%', height: 6, backgroundColor: '#ECF0F1', borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', backgroundColor: '#45B7D1', borderRadius: 3 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },

  card: {
    width: '48%', borderRadius: 16, padding: 14, marginBottom: 14,
    borderLeftWidth: 4, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  cardTop:      { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardIcon:     { fontSize: 15, marginRight: 5 },
  cardLabel:    { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, flex: 1 },
  changeBadge:  { fontSize: 13, fontWeight: '800' },

  cardValueRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 4 },
  cardValue:    { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  cardUnit:     { fontSize: 12, fontWeight: '600', marginLeft: 3 },
  prevValue:    { fontSize: 10, color: '#95A5A6', marginBottom: 4, fontStyle: 'italic' },

  rangeLabel:   { fontSize: 9, color: '#B0BEC5', marginBottom: 4, fontStyle: 'italic' },

  pill: {
    alignSelf: 'flex-start', borderRadius: 6, borderWidth: 1,
    paddingHorizontal: 6, paddingVertical: 2, marginBottom: 5,
  },
  pillTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },

  cardBar:     { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  cardBarFill: { height: '100%', borderRadius: 2 },

  errorBox: {
    backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FFCDD2',
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
  },
  errorIcon: { fontSize: 20 },
  errorText: { flex: 1, color: '#C62828', fontSize: 13 },
  retryBtn:  { backgroundColor: '#C62828', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  footer: { textAlign: 'center', color: '#BDC3C7', fontSize: 11, marginTop: 8 },
});
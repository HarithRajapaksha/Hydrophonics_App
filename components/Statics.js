import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import axios from 'axios';

// ─── Config ────────────────────────────────────────────────────────────────────
const REFRESH_INTERVAL = 5000;
const SCREEN_WIDTH = Dimensions.get('window').width;

const SENSORS = [
  { key: 'airTemp',    label: 'Air Temperature',  unit: '°C',  color: '#FF6B6B', icon: '🌡️' },
  { key: 'humidity',   label: 'Humidity',          unit: '%',   color: '#4ECDC4', icon: '💧' },
  { key: 'waterTemp',  label: 'Water Temperature', unit: '°C',  color: '#45B7D1', icon: '🌊' },
  { key: 'waterLevel', label: 'Water Level',       unit: 'cm',  color: '#96CEB4', icon: '📏' },
  { key: 'pH',         label: 'pH Level',          unit: 'pH',  color: '#C39BD3', icon: '🧪' },
  { key: 'TDS',        label: 'TDS',               unit: 'ppm', color: '#F0B27A', icon: '⚗️' },
];

// Point-count based windows — works with any timestamps, old or new
const WINDOWS = [
  { label: 'Last 10',  value: 10 },
  { label: 'Last 20',  value: 20 },
  { label: 'Last 50',  value: 50 },
  { label: 'Last 100', value: 100 },
  { label: 'All',      value: Infinity },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
const formatTimestamp = (ts) => {
  // "2026-03-13_12-34-56" → "12:34"
  const parts = ts.split('_');
  if (parts.length >= 2) {
    return parts[1].replace(/-/g, ':').substring(0, 5);
  }
  return ts;
};

// ─── Single chart card ─────────────────────────────────────────────────────────
const SensorChart = ({ sensor, dataHistory }) => {
  const chartWidth = SCREEN_WIDTH - 48;

  if (!dataHistory || dataHistory.length < 2) {
    return (
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartIcon}>{sensor.icon}</Text>
          <Text style={[styles.chartTitle, { color: sensor.color }]}>{sensor.label}</Text>
        </View>
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>Not enough data yet…</Text>
        </View>
      </View>
    );
  }

  const values = dataHistory.map((d) => {
    const v = parseFloat(d.value);
    return isNaN(v) ? 0 : v;
  });

  // Show ~4 evenly-spaced labels so they don't overlap
  const labelEvery = Math.max(1, Math.floor(dataHistory.length / 4));
  const labels = dataHistory.map((d, i) =>
    i % labelEvery === 0 ? formatTimestamp(d.timestamp) : ''
  );

  const currentVal = values[values.length - 1];
  const minVal     = Math.min(...values);
  const maxVal     = Math.max(...values);
  const avgVal     = values.reduce((a, b) => a + b, 0) / values.length;

  const chartData = {
    labels,
    datasets: [{ data: values, color: () => sensor.color, strokeWidth: 2 }],
  };

  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 1,
    color: (opacity = 1) =>
      sensor.color + Math.round(opacity * 255).toString(16).padStart(2, '0'),
    labelColor: () => '#95A5A6',
    style: { borderRadius: 12 },
    propsForDots: { r: '3', strokeWidth: '1', stroke: sensor.color },
    propsForBackgroundLines: { strokeDasharray: '', stroke: '#ECF0F1', strokeWidth: 1 },
  };

  // Widen chart when there are many points so labels don't squish
  const dynamicWidth = Math.max(chartWidth, dataHistory.length * 28);

  return (
    <View style={styles.chartCard}>
      {/* Header */}
      <View style={styles.chartHeader}>
        <Text style={styles.chartIcon}>{sensor.icon}</Text>
        <Text style={[styles.chartTitle, { color: sensor.color }]}>{sensor.label}</Text>
        <View style={[styles.currentBadge, { backgroundColor: sensor.color + '20', borderColor: sensor.color }]}>
          <Text style={[styles.currentVal, { color: sensor.color }]}>
            {currentVal.toFixed(1)} {sensor.unit}
          </Text>
        </View>
      </View>

      {/* Stat strip */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>MIN</Text>
          <Text style={styles.statValue}>{minVal.toFixed(1)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>AVG</Text>
          <Text style={styles.statValue}>{avgVal.toFixed(1)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>MAX</Text>
          <Text style={styles.statValue}>{maxVal.toFixed(1)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>POINTS</Text>
          <Text style={styles.statValue}>{dataHistory.length}</Text>
        </View>
      </View>

      {/* Horizontally scrollable chart */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <LineChart
          data={chartData}
          width={dynamicWidth}
          height={180}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withDots={dataHistory.length <= 40}
          withShadow={false}
          withInnerLines
          withOuterLines={false}
          fromZero={false}
        />
      </ScrollView>

      {/* Time range footer */}
      <View style={styles.chartFooter}>
        <Text style={styles.chartFooterText}>
          {formatTimestamp(dataHistory[0].timestamp)}
        </Text>
        <Text style={styles.chartFooterCenter}>← scroll →</Text>
        <Text style={styles.chartFooterText}>
          {formatTimestamp(dataHistory[dataHistory.length - 1].timestamp)}
        </Text>
      </View>
    </View>
  );
};

// ─── Main ──────────────────────────────────────────────────────────────────────
const Statics = () => {
  const [allData,        setAllData]        = useState({});
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [error,          setError]          = useState(null);
  const [isLive,         setIsLive]         = useState(true);
  const [pointWindow,    setPointWindow]    = useState(WINDOWS[1].value); // last 20
  const [selectedSensor, setSelectedSensor] = useState(null);             // null = all

  const fetchRef = useRef(null);

  const API_URL = Platform.OS === 'android'
    ? 'http://10.0.2.2:5000/getdata'
    : 'http://localhost:5000/getdata';

  const fetchData = useCallback(async (isManual = false) => {
    try {
      setError(null);
      if (isManual) setRefreshing(true);
      const response = await axios.get(API_URL);
      // Merge new data on top of existing data so newly polled readings
      // are appended without losing earlier historical readings
      setAllData((prev) => ({ ...prev, ...response.data }));
    } catch (err) {
      setError('Cannot reach server. Is it running?');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [API_URL]);

  // Initial fetch
  useEffect(() => { fetchData(); }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (!isLive) { clearInterval(fetchRef.current); return; }
    fetchRef.current = setInterval(() => fetchData(), REFRESH_INTERVAL);
    return () => clearInterval(fetchRef.current);
  }, [isLive, fetchData]);

  /**
   * buildHistory
   * ─────────────
   * Works with ANY data regardless of how old the timestamps are.
   * Sorts all keys chronologically (lexicographic sort works because the
   * timestamp format is "YYYY-MM-DD_HH-MM-SS"), then slices the last N.
   * New readings polled from the server are merged into allData, so they
   * appear automatically at the right end of each chart.
   */
  const buildHistory = useCallback(
    (sensorKey) => {
      const timestamps = Object.keys(allData).sort();
      const sliced =
        pointWindow === Infinity ? timestamps : timestamps.slice(-pointWindow);
      return sliced.map((ts) => ({
        timestamp: ts,
        value: allData[ts][sensorKey],
      }));
    },
    [allData, pointWindow]
  );

  const sensorsToShow = selectedSensor
    ? SENSORS.filter((s) => s.key === selectedSensor)
    : SENSORS;

  const totalReadings  = Object.keys(allData).length;
  const windowReadings = totalReadings > 0 ? buildHistory('airTemp').length : 0;

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#45B7D1" />
        <Text style={styles.loadingText}>Loading sensor history…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            tintColor="#45B7D1"
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Statistics</Text>
          <TouchableOpacity
            style={[
              styles.liveBtn,
              {
                borderColor: isLive ? '#4ECDC4' : '#E74C3C',
                backgroundColor: isLive ? '#E8FBF8' : '#FFF0F0',
              },
            ]}
            onPress={() => setIsLive((v) => !v)}
          >
            <View style={[styles.dot, { backgroundColor: isLive ? '#4ECDC4' : '#E74C3C' }]} />
            <Text style={[styles.liveBtnText, { color: isLive ? '#4ECDC4' : '#E74C3C' }]}>
              {isLive ? 'LIVE' : 'PAUSED'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Summary cards ── */}
        {!error && (
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryVal}>{totalReadings}</Text>
              <Text style={styles.summaryLbl}>TOTAL READINGS</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryVal}>{windowReadings}</Text>
              <Text style={styles.summaryLbl}>IN VIEW</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryVal}>{SENSORS.length}</Text>
              <Text style={styles.summaryLbl}>SENSORS</Text>
            </View>
          </View>
        )}

        {/* ── Point window selector ── */}
        <Text style={styles.sectionText}>Show last N readings</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={{ paddingBottom: 4 }}
        >
          {WINDOWS.map((w) => (
            <TouchableOpacity
              key={String(w.value)}
              style={[styles.filterBtn, pointWindow === w.value && styles.filterBtnActive]}
              onPress={() => setPointWindow(w.value)}
            >
              <Text
                style={[
                  styles.filterBtnText,
                  pointWindow === w.value && styles.filterBtnTextActive,
                ]}
              >
                {w.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Sensor filter ── */}
        <Text style={styles.sectionText}>Sensor</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterRow}
          contentContainerStyle={{ paddingBottom: 4 }}
        >
          <TouchableOpacity
            style={[styles.filterBtn, selectedSensor === null && styles.filterBtnActive]}
            onPress={() => setSelectedSensor(null)}
          >
            <Text
              style={[
                styles.filterBtnText,
                selectedSensor === null && styles.filterBtnTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {SENSORS.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[
                styles.filterBtn,
                selectedSensor === s.key && {
                  backgroundColor: s.color + '20',
                  borderColor: s.color,
                },
              ]}
              onPress={() =>
                setSelectedSensor(selectedSensor === s.key ? null : s.key)
              }
            >
              <Text style={{ fontSize: 12 }}>{s.icon} </Text>
              <Text
                style={[
                  styles.filterBtnText,
                  selectedSensor === s.key && { color: s.color, fontWeight: '700' },
                ]}
              >
                {s.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Error ── */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️  {error}</Text>
            <TouchableOpacity onPress={() => fetchData(true)}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Charts ── */}
        {!error &&
          sensorsToShow.map((sensor) => (
            <SensorChart
              key={sensor.key}
              sensor={sensor}
              dataHistory={buildHistory(sensor.key)}
            />
          ))}

        <Text style={styles.footer}>
          Pull to refresh  •  New readings append automatically when LIVE
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

export default Statics;

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F0F4F8' },

  loadingScreen: {
    flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F4F8',
  },
  loadingText: { marginTop: 12, fontSize: 15, color: '#7F8C8D', fontWeight: '500' },

  scroll: { padding: 16, paddingBottom: 40 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#1A252F', letterSpacing: -0.5 },

  liveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
  },
  liveBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  sectionText: {
    fontSize: 11, fontWeight: '700', color: '#95A5A6',
    letterSpacing: 0.8, marginTop: 10, marginBottom: 6,
  },

  filterRow: { marginBottom: 4 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: '#DFE6E9',
    backgroundColor: '#FFFFFF', marginRight: 8,
  },
  filterBtnActive: { backgroundColor: '#45B7D120', borderColor: '#45B7D1' },
  filterBtnText: { fontSize: 12, color: '#7F8C8D', fontWeight: '600' },
  filterBtnTextActive: { color: '#45B7D1', fontWeight: '700' },

  errorBox: {
    backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#FFCDD2',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 16, marginTop: 8,
  },
  errorText: { color: '#C62828', fontSize: 13, flex: 1 },
  retryText: { color: '#C62828', fontSize: 13, fontWeight: '700', marginLeft: 12 },

  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, gap: 10,
  },
  summaryCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  summaryVal: { fontSize: 22, fontWeight: '800', color: '#2C3E50' },
  summaryLbl: { fontSize: 9, color: '#95A5A6', marginTop: 4, letterSpacing: 0.8, fontWeight: '600' },

  chartCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  chartHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  chartIcon: { fontSize: 16 },
  chartTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  currentBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1,
  },
  currentVal: { fontSize: 13, fontWeight: '800' },

  statsRow: { flexDirection: 'row', marginBottom: 10, gap: 8 },
  statBox: {
    flex: 1, backgroundColor: '#F8F9FA', borderRadius: 8,
    padding: 8, alignItems: 'center',
  },
  statLabel: { fontSize: 9, color: '#95A5A6', fontWeight: '700', letterSpacing: 0.6 },
  statValue: { fontSize: 14, fontWeight: '700', color: '#2C3E50', marginTop: 2 },

  chart: { borderRadius: 12, marginLeft: -8 },

  chartFooter: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 6,
  },
  chartFooterText: { fontSize: 10, color: '#BDC3C7' },
  chartFooterCenter: { fontSize: 10, color: '#BDC3C7', fontStyle: 'italic' },

  noDataContainer: { height: 120, justifyContent: 'center', alignItems: 'center' },
  noDataText: { color: '#BDC3C7', fontSize: 13, fontStyle: 'italic' },

  footer: { textAlign: 'center', color: '#BDC3C7', fontSize: 11, marginTop: 8 },
});
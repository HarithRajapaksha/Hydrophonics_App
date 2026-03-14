import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, ScrollView,
  Switch, TextInput, TouchableOpacity,
  Platform, Alert, KeyboardAvoidingView,
} from 'react-native';

import { requestPermissions, scheduleNotification } from './Notifications';

// ─── Default threshold values ─────────────────────────────────────────────────
export const DEFAULT_THRESHOLDS = {
  pH:         { label: 'pH මට්ටම',           unit: 'pH',  icon: '🧪', color: '#C39BD3', min: 5.5,  max: 6.5  },
  TDS:        { label: 'TDS',                 unit: 'ppm', icon: '⚗️', color: '#F0B27A', min: 500,  max: 900  },
  waterTemp:  { label: 'ජල උෂ්ණත්වය',        unit: '°C',  icon: '🌊', color: '#45B7D1', min: 20,   max: 30   },
  airTemp:    { label: 'වායු උෂ්ණත්වය',       unit: '°C',  icon: '🌡️', color: '#FF6B6B', min: 25,   max: 35   },
  humidity:   { label: 'ආර්ද්‍රතාවය',          unit: '%',   icon: '💧', color: '#4ECDC4', min: 50,   max: 70   },
  waterLevel: { label: 'ජල මට්ටම',            unit: 'cm',  icon: '📏', color: '#96CEB4', min: 10,   max: null },
};

// ─── Debounce tracker: prevent re-firing same alert every 5s poll ────────────
const alertedState = {};

// ─── checkAndNotify — called from HomePage on every data fetch ────────────────
export async function checkAndNotify(sensorKey, value, thresholds, alertsEnabled) {
  if (!alertsEnabled) return;

  const config = DEFAULT_THRESHOLDS[sensorKey];
  const limit  = thresholds?.[sensorKey];
  if (!config || !limit || value === undefined || value === null) return;

  const numVal = Number(value);
  if (isNaN(numVal)) return;

  let breached  = false;
  let direction = '';
  let alertKey  = '';

  if (limit.min !== null && limit.min !== undefined && numVal < limit.min) {
    breached  = true;
    direction = `අවම සීමාවට වඩා අඩුයි (${limit.min} ${config.unit})`;
    alertKey  = `${sensorKey}_low`;
  } else if (limit.max !== null && limit.max !== undefined && numVal > limit.max) {
    breached  = true;
    direction = `උපරිම සීමාවට වඩා වැඩියි (${limit.max} ${config.unit})`;
    alertKey  = `${sensorKey}_high`;
  }

  if (breached) {
    if (alertedState[alertKey]) return; // fire only once per breach
    alertedState[alertKey] = true;

    await scheduleNotification({
      title: `⚠️ ${config.icon} ${config.label} අනතුරු ඇඟවීම!`,
      body:  `කියවීම ${numVal.toFixed(1)} ${config.unit} — ${direction}.\nආරක්ෂිත පරාසය: ${limit.min ?? '—'} – ${limit.max ?? '∞'} ${config.unit}`,
      data:  { sensorKey, value: numVal },
    });
  } else {
    // Back in range — clear flag so next breach fires again
    delete alertedState[`${sensorKey}_low`];
    delete alertedState[`${sensorKey}_high`];
  }
}

// ─── Single sensor threshold card ─────────────────────────────────────────────
const ThresholdCard = ({ sensorKey, config, values, onChange, alertsEnabled }) => {
  const [editing,  setEditing]  = useState(false);
  const [localMin, setLocalMin] = useState(String(values.min ?? ''));
  const [localMax, setLocalMax] = useState(String(values.max ?? ''));

  const openEdit = () => {
    setLocalMin(String(values.min ?? ''));
    setLocalMax(String(values.max ?? ''));
    setEditing(true);
  };

  const handleSave = () => {
    const minVal = localMin === '' ? null : parseFloat(localMin);
    const maxVal = localMax === '' ? null : parseFloat(localMax);
    if (localMin !== '' && isNaN(minVal)) {
      Alert.alert('Invalid value', `Min for ${config.label} must be a number.`); return;
    }
    if (localMax !== '' && isNaN(maxVal)) {
      Alert.alert('Invalid value', `Max for ${config.label} must be a number.`); return;
    }
    if (minVal !== null && maxVal !== null && minVal >= maxVal) {
      Alert.alert('Invalid range', `Min must be less than Max for ${config.label}.`); return;
    }
    onChange(sensorKey, { min: minVal, max: maxVal });
    setEditing(false);
  };

  const handleReset = () => {
    const def = DEFAULT_THRESHOLDS[sensorKey];
    setLocalMin(String(def.min ?? ''));
    setLocalMax(String(def.max ?? ''));
    onChange(sensorKey, { min: def.min, max: def.max });
    setEditing(false);
  };

  const isCustom =
    values.min !== DEFAULT_THRESHOLDS[sensorKey].min ||
    values.max !== DEFAULT_THRESHOLDS[sensorKey].max;

  return (
    <View style={[cs.card, { borderLeftColor: config.color }]}>

      {/* Header */}
      <View style={cs.header}>
        <Text style={cs.icon}>{config.icon}</Text>
        <View style={{ flex: 1 }}>
          <Text style={cs.label}>{config.label}</Text>
          <Text style={cs.unit}>{config.unit}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          {isCustom && (
            <View style={cs.customTag}>
              <Text style={cs.customTagTxt}>CUSTOM</Text>
            </View>
          )}
          <View style={[cs.alertTag, { backgroundColor: alertsEnabled ? config.color + '22' : '#F0F4F8' }]}>
            <View style={[cs.alertDot, { backgroundColor: alertsEnabled ? config.color : '#BDC3C7' }]} />
            <Text style={[cs.alertTagTxt, { color: alertsEnabled ? config.color : '#BDC3C7' }]}>
              {alertsEnabled ? 'Alert ON' : 'OFF'}
            </Text>
          </View>
        </View>
      </View>

      {/* Display mode */}
      {!editing ? (
        <View style={cs.displayRow}>
          <View style={[cs.chip, { backgroundColor: '#EBF5FB' }]}>
            <Text style={cs.chipLbl}>MIN</Text>
            <Text style={[cs.chipVal, { color: '#2980B9' }]}>
              {values.min !== null && values.min !== undefined ? `${values.min}` : '—'}
            </Text>
            <Text style={cs.chipUnit}>{config.unit}</Text>
          </View>
          <Text style={cs.rangeSep}>—</Text>
          <View style={[cs.chip, { backgroundColor: '#FEF9E7' }]}>
            <Text style={cs.chipLbl}>MAX</Text>
            <Text style={[cs.chipVal, { color: '#D4AC0D' }]}>
              {values.max !== null && values.max !== undefined ? `${values.max}` : '∞'}
            </Text>
            <Text style={cs.chipUnit}>{config.unit}</Text>
          </View>
          <TouchableOpacity style={[cs.editBtn, { borderColor: config.color }]} onPress={openEdit}>
            <Text style={[cs.editBtnTxt, { color: config.color }]}>✏️ Edit</Text>
          </TouchableOpacity>
        </View>

      ) : (
        /* Edit mode */
        <View style={cs.editBlock}>
          <View style={cs.rangeHint}>
            <Text style={cs.rangeHintTxt}>
              📋 Default: {DEFAULT_THRESHOLDS[sensorKey].min ?? '—'} – {DEFAULT_THRESHOLDS[sensorKey].max ?? '∞'} {config.unit}
            </Text>
          </View>
          <View style={cs.inputRow}>
            <View style={cs.inputGroup}>
              <Text style={cs.inputLbl}>Min ({config.unit})</Text>
              <TextInput
                style={cs.input}
                value={localMin}
                onChangeText={setLocalMin}
                keyboardType="decimal-pad"
                placeholder={`e.g. ${DEFAULT_THRESHOLDS[sensorKey].min ?? '—'}`}
                placeholderTextColor="#BDC3C7"
                returnKeyType="done"
              />
            </View>
            <View style={cs.inputGroup}>
              <Text style={cs.inputLbl}>
                Max ({config.unit}){DEFAULT_THRESHOLDS[sensorKey].max === null ? ' (optional)' : ''}
              </Text>
              <TextInput
                style={cs.input}
                value={localMax}
                onChangeText={setLocalMax}
                keyboardType="decimal-pad"
                placeholder={
                  DEFAULT_THRESHOLDS[sensorKey].max !== null
                    ? `e.g. ${DEFAULT_THRESHOLDS[sensorKey].max}`
                    : 'blank = no limit'
                }
                placeholderTextColor="#BDC3C7"
                returnKeyType="done"
              />
            </View>
          </View>
          <View style={cs.actionRow}>
            <TouchableOpacity style={cs.saveBtn}   onPress={handleSave}>
              <Text style={cs.saveTxt}>✓  Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cs.resetBtn}  onPress={handleReset}>
              <Text style={cs.resetTxt}>↺  Default</Text>
            </TouchableOpacity>
            <TouchableOpacity style={cs.cancelBtn} onPress={() => setEditing(false)}>
              <Text style={cs.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

// ─── Settings screen ──────────────────────────────────────────────────────────
const Setting = ({
  thresholds: propThresholds,
  onThresholdsChange,
  alertsEnabled,          // passed from App.js
  onAlertsEnabledChange,  // passed from App.js
}) => {
  const [localThresholds,    setLocalThresholds]    = useState(() => {
    const t = {};
    Object.entries(DEFAULT_THRESHOLDS).forEach(([k, v]) => { t[k] = { min: v.min, max: v.max }; });
    return t;
  });
  const [localAlertsEnabled, setLocalAlertsEnabled] = useState(true);
  const [autoRefresh,        setAutoRefresh]        = useState(true);
  const [notifAvailable,     setNotifAvailable]     = useState(true);

  const activeThresholds = propThresholds ?? localThresholds;
  const isAlertsOn       = alertsEnabled  ?? localAlertsEnabled;
  const setAlertsOn      = onAlertsEnabledChange ?? setLocalAlertsEnabled;

  useEffect(() => {
    (async () => {
      const granted = await requestPermissions();
      if (!granted) {
        setAlertsOn(false);
        setNotifAvailable(false);
      }
    })();
  }, []);

  const handleChange = (key, val) => {
    const updated = { ...activeThresholds, [key]: val };
    if (onThresholdsChange) onThresholdsChange(updated);
    else setLocalThresholds(updated);
  };

  const handleResetAll = () => {
    Alert.alert('Reset All Thresholds', 'Restore every sensor to factory defaults?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset All', style: 'destructive',
        onPress: () => {
          const defaults = {};
          Object.entries(DEFAULT_THRESHOLDS).forEach(([k, v]) => { defaults[k] = { min: v.min, max: v.max }; });
          if (onThresholdsChange) onThresholdsChange(defaults);
          else setLocalThresholds(defaults);
        },
      },
    ]);
  };

  return (
    <View style={ss.root}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={ss.scroll} keyboardShouldPersistTaps="handled">

          <View style={ss.header}>
            <Text style={ss.title}>Settings</Text>
            <Text style={ss.sub}>Hydro Monitor Configuration</Text>
          </View>

          {/* Expo Go warning */}
          {!notifAvailable && (
            <View style={ss.warnBox}>
              <Text style={ss.warnTxt}>
                ⚠️  Push notifications not available in Expo Go SDK 53+.
                Use a <Text style={{ fontWeight: '800' }}>development build</Text> to enable them.{'\n'}
                In-app threshold indicators (red cards) still work on Home screen.
              </Text>
            </View>
          )}

          {/* Alert status banner */}
          {notifAvailable && (
            <View style={[ss.alertBanner, {
              backgroundColor: isAlertsOn ? '#E8FBF8' : '#FFF0F0',
              borderColor:     isAlertsOn ? '#4ECDC4' : '#E74C3C',
            }]}>
              <Text style={{ fontSize: 24 }}>{isAlertsOn ? '🔔' : '🔕'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[ss.alertBannerTitle, { color: isAlertsOn ? '#1A8A7A' : '#C0392B' }]}>
                  Alerts {isAlertsOn ? 'ENABLED' : 'DISABLED'}
                </Text>
                <Text style={ss.alertBannerSub}>
                  {isAlertsOn
                    ? 'Push notification fires when any sensor leaves its safe range.'
                    : 'Toggle below to re-enable push notifications.'}
                </Text>
              </View>
            </View>
          )}

          {/* Factory defaults reference */}
          <View style={ss.refCard}>
            <Text style={ss.refTitle}>📋  Factory Default Ranges</Text>
            {Object.entries(DEFAULT_THRESHOLDS).map(([key, cfg]) => (
              <View key={key} style={ss.refRow}>
                <Text style={ss.refIcon}>{cfg.icon}</Text>
                <Text style={ss.refLabel}>{cfg.label}</Text>
                <Text style={[ss.refRange, { color: cfg.color }]}>
                  {cfg.min ?? '—'} – {cfg.max ?? '∞'} {cfg.unit}
                </Text>
              </View>
            ))}
          </View>

          {/* General toggles */}
          <Text style={ss.sectionLbl}>GENERAL</Text>
          <View style={ss.card}>
            <View style={ss.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={ss.toggleLbl}>Auto Refresh</Text>
                <Text style={ss.toggleSub}>Fetch new data every 5 seconds</Text>
              </View>
              <Switch value={autoRefresh} onValueChange={setAutoRefresh}
                trackColor={{ false: '#ECF0F1', true: '#45B7D1' }}
                thumbColor="#FFFFFF" ios_backgroundColor="#ECF0F1" />
            </View>
            <View style={[ss.toggleRow, ss.divider]}>
              <View style={{ flex: 1 }}>
                <Text style={ss.toggleLbl}>🔔  Threshold Alerts</Text>
                <Text style={ss.toggleSub}>
                  {notifAvailable
                    ? 'Push notification when any sensor goes out of range'
                    : 'In-app indicators only (Expo Go limitation)'}
                </Text>
              </View>
              <Switch
                value={isAlertsOn}
                onValueChange={setAlertsOn}
                trackColor={{ false: '#ECF0F1', true: '#4ECDC4' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#ECF0F1"
                disabled={!notifAvailable}
              />
            </View>
          </View>

          {/* Threshold cards */}
          <View style={ss.sectionRow}>
            <Text style={ss.sectionLbl}>SENSOR THRESHOLDS</Text>
            <TouchableOpacity onPress={handleResetAll}>
              <Text style={ss.resetAllTxt}>↺ Reset all</Text>
            </TouchableOpacity>
          </View>

          <View style={ss.hintBox}>
            <Text style={ss.hintTxt}>
              📌  Tap <Text style={{ fontWeight: '700' }}>✏️ Edit</Text> on any card to set custom
              Min / Max. Notification fires once per breach and resets when the
              reading returns to the safe range.
            </Text>
          </View>

          {Object.entries(DEFAULT_THRESHOLDS).map(([key, config]) => (
            <ThresholdCard
              key={key}
              sensorKey={key}
              config={config}
              values={activeThresholds[key]}
              onChange={handleChange}
              alertsEnabled={isAlertsOn}
            />
          ))}

          {/* Server info */}
          <Text style={ss.sectionLbl}>SERVER</Text>
          <View style={ss.card}>
            {[
              { label: 'Server URL',       value: Platform.OS === 'android' ? '10.0.2.2:5000' : 'localhost:5000' },
              { label: 'Refresh Interval', value: '5 seconds' },
              { label: 'Platform',         value: Platform.OS === 'android' ? 'Android' : 'iOS' },
              { label: 'App Version',      value: '1.0.0' },
            ].map((item, idx, arr) => (
              <View key={item.label} style={[ss.infoRow, idx < arr.length - 1 && ss.divider]}>
                <Text style={ss.infoLbl}>{item.label}</Text>
                <Text style={ss.infoVal}>{item.value}</Text>
              </View>
            ))}
          </View>

          <Text style={ss.footer}>Hydro Monitor  •  Built with React Native</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default Setting;

const cs = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 12, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  header:       { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  icon:         { fontSize: 20 },
  label:        { fontSize: 14, fontWeight: '700', color: '#2C3E50' },
  unit:         { fontSize: 11, color: '#95A5A6', marginTop: 1 },
  customTag:    { backgroundColor: '#FEF9E7', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  customTagTxt: { fontSize: 9, fontWeight: '800', color: '#D4AC0D', letterSpacing: 0.5 },
  alertTag:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  alertDot:     { width: 6, height: 6, borderRadius: 3 },
  alertTagTxt:  { fontSize: 10, fontWeight: '700' },
  displayRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip:         { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  chipLbl:      { fontSize: 9, fontWeight: '800', color: '#95A5A6', letterSpacing: 0.8 },
  chipVal:      { fontSize: 20, fontWeight: '800', marginTop: 2 },
  chipUnit:     { fontSize: 10, color: '#95A5A6', marginTop: 1 },
  rangeSep:     { fontSize: 18, color: '#BDC3C7', fontWeight: '300' },
  editBtn:      { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5 },
  editBtnTxt:   { fontSize: 12, fontWeight: '700' },
  rangeHint:    { backgroundColor: '#EAF6FF', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 8 },
  rangeHintTxt: { fontSize: 11, color: '#2C3E50', fontStyle: 'italic' },
  editBlock:    { gap: 10 },
  inputRow:     { flexDirection: 'row', gap: 10 },
  inputGroup:   { flex: 1 },
  inputLbl:     { fontSize: 11, fontWeight: '700', color: '#7F8C8D', marginBottom: 5, letterSpacing: 0.4 },
  input: {
    backgroundColor: '#F8F9FA', borderRadius: 10, borderWidth: 1.5, borderColor: '#DFE6E9',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#2C3E50', fontWeight: '600',
  },
  actionRow: { flexDirection: 'row', gap: 8 },
  saveBtn:   { flex: 1, backgroundColor: '#45B7D1', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  saveTxt:   { color: '#fff', fontSize: 13, fontWeight: '700' },
  resetBtn:  { flex: 1, backgroundColor: '#FFF3E0', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  resetTxt:  { color: '#E67E22', fontSize: 13, fontWeight: '700' },
  cancelBtn: { flex: 1, backgroundColor: '#F0F4F8', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  cancelTxt: { color: '#7F8C8D', fontSize: 13, fontWeight: '600' },
});

const ss = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#F0F4F8' },
  scroll: { padding: 16, paddingBottom: 48 },
  header: { marginBottom: 16 },
  title:  { fontSize: 26, fontWeight: '800', color: '#1A252F', letterSpacing: -0.5 },
  sub:    { fontSize: 12, color: '#95A5A6', marginTop: 4 },

  warnBox: {
    backgroundColor: '#FFF8E1', borderRadius: 12, padding: 12, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: '#FFA000',
  },
  warnTxt: { fontSize: 12, color: '#5D4037', lineHeight: 18 },

  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 16,
  },
  alertBannerTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.3 },
  alertBannerSub:   { fontSize: 11, color: '#7F8C8D', marginTop: 2, lineHeight: 16 },

  refCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  refTitle: { fontSize: 13, fontWeight: '800', color: '#2C3E50', marginBottom: 10 },
  refRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8 },
  refIcon:  { fontSize: 15, width: 22 },
  refLabel: { flex: 1, fontSize: 12, color: '#2C3E50', fontWeight: '600' },
  refRange: { fontSize: 12, fontWeight: '700' },

  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginTop: 8, marginBottom: 4, marginHorizontal: 4,
  },
  sectionLbl:  { fontSize: 10, fontWeight: '700', color: '#95A5A6', letterSpacing: 1.2, marginTop: 22, marginBottom: 6, marginLeft: 4 },
  resetAllTxt: { fontSize: 12, color: '#E74C3C', fontWeight: '700' },

  hintBox: {
    backgroundColor: '#EAF6FF', borderRadius: 12, padding: 12, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: '#45B7D1',
  },
  hintTxt: { fontSize: 12, color: '#2C3E50', lineHeight: 18 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, marginBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  toggleLbl: { fontSize: 15, color: '#2C3E50', fontWeight: '600' },
  toggleSub: { fontSize: 11, color: '#95A5A6', marginTop: 2 },
  divider:   { borderTopWidth: 1, borderTopColor: '#F0F4F8' },
  infoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  infoLbl:   { fontSize: 15, color: '#2C3E50', fontWeight: '500' },
  infoVal:   { fontSize: 14, color: '#95A5A6', fontWeight: '500' },
  footer:    { textAlign: 'center', color: '#BDC3C7', fontSize: 11, marginTop: 20 },
});
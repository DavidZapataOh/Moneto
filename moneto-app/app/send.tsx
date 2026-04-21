import { useMemo, useState } from "react";
import { View, Pressable, TextInput, Keyboard } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeIn,
  LinearTransition,
} from "react-native-reanimated";
import { Screen } from "@components/ui/Screen";
import { Text } from "@components/ui/Text";
import { Card } from "@components/ui/Card";
import { Button } from "@components/ui/Button";
import { IconButton } from "@components/ui/IconButton";
import { Avatar } from "@components/ui/Avatar";
import { Badge } from "@components/ui/Badge";
import { useAppStore } from "@stores/useAppStore";
import { useTheme } from "@hooks/useTheme";
import { haptics } from "@hooks/useHaptics";
import { fonts } from "@theme/typography";
import type { User } from "@data/mock";

type Mode = "p2p" | "cashout";

export default function SendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { colors } = useTheme();

  const balance = useAppStore((s) => s.balance);
  const contacts = useAppStore((s) => s.contacts);
  const sendP2P = useAppStore((s) => s.sendP2P);

  const [mode, setMode] = useState<Mode>(params.mode === "cashout" ? "cashout" : "p2p");
  const [amount, setAmount] = useState("");
  const [selected, setSelected] = useState<User | null>(null);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");

  const amountNumber = Number(amount) || 0;
  const canSend = amountNumber > 0 && amountNumber <= balance.availableUsd && (mode === "cashout" || !!selected);

  const filtered = useMemo(
    () =>
      contacts.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.handle.toLowerCase().includes(query.toLowerCase())
      ),
    [contacts, query]
  );

  const handleSend = () => {
    if (!canSend) return;
    haptics.medium();
    if (mode === "p2p" && selected) {
      sendP2P(selected, amountNumber, note);
    }
    router.replace({
      pathname: "/send-success",
      params: {
        amount: amountNumber.toString(),
        to: mode === "cashout" ? "Bancolombia •••• 0284" : selected?.name ?? "",
        mode,
      },
    });
  };

  return (
    <Screen padded edges={["top", "bottom"]}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 4,
          marginBottom: 16,
        }}
      >
        <Text variant="h2">{mode === "cashout" ? "Retirar a peso" : "Enviar"}</Text>
        <IconButton
          icon={<Ionicons name="close" size={20} color={colors.text.primary} />}
          variant="filled"
          size="sm"
          onPress={() => router.back()}
          label="Cerrar"
        />
      </View>

      {/* Mode switcher */}
      <View style={{ flexDirection: "row", gap: 6, marginBottom: 20 }}>
        <ModePill
          active={mode === "p2p"}
          label="A otra persona"
          icon="person-outline"
          onPress={() => {
            haptics.select();
            setMode("p2p");
          }}
        />
        <ModePill
          active={mode === "cashout"}
          label="A mi banco"
          icon="business-outline"
          onPress={() => {
            haptics.select();
            setMode("cashout");
          }}
        />
      </View>

      {/* Amount input */}
      <Animated.View entering={FadeInDown.duration(300)}>
        <Card variant="sunken" padded radius="xl">
          <Text variant="label" tone="secondary">
            Monto
          </Text>
          <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 8 }}>
            <Text
              style={{
                fontFamily: fonts.monoMedium,
                fontSize: 44,
                color: colors.text.tertiary,
                letterSpacing: -1,
              }}
            >
              $
            </Text>
            <TextInput
              value={amount}
              onChangeText={(v) => {
                haptics.select();
                setAmount(v.replace(/[^0-9.]/g, ""));
              }}
              placeholder="0"
              placeholderTextColor={colors.text.tertiary}
              keyboardType="decimal-pad"
              style={{
                flex: 1,
                fontFamily: fonts.monoMedium,
                fontSize: 52,
                color: colors.text.primary,
                letterSpacing: -1.2,
                padding: 0,
                margin: 0,
              }}
              autoFocus
            />
            <Text
              style={{
                fontFamily: fonts.sansMedium,
                fontSize: 14,
                color: colors.text.tertiary,
                marginLeft: 4,
              }}
            >
              USD
            </Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
            <Text variant="bodySmall" tone="tertiary">
              Disponible: ${balance.availableUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </Text>
            <Pressable
              onPress={() => {
                haptics.tap();
                setAmount(balance.availableUsd.toString());
              }}
              hitSlop={8}
            >
              <Text variant="bodySmall" tone="brand">
                Usar todo
              </Text>
            </Pressable>
          </View>
        </Card>
      </Animated.View>

      {/* Recipient */}
      {mode === "p2p" ? (
        <View style={{ marginTop: 20, flex: 1 }}>
          <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
            Para
          </Text>

          {!selected ? (
            <Animated.View layout={LinearTransition}>
              <Card variant="outlined" padded={false} radius="md">
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: 14,
                    gap: 10,
                  }}
                >
                  <Ionicons name="search" size={16} color={colors.text.tertiary} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Buscá por nombre o @usuario"
                    placeholderTextColor={colors.text.tertiary}
                    style={{
                      flex: 1,
                      paddingVertical: 14,
                      fontFamily: fonts.sansRegular,
                      fontSize: 15,
                      color: colors.text.primary,
                    }}
                  />
                </View>
              </Card>
              <View style={{ gap: 2, marginTop: 8 }}>
                {filtered.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      haptics.tap();
                      setSelected(c);
                      Keyboard.dismiss();
                    }}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 4,
                      borderRadius: 12,
                      backgroundColor: pressed ? colors.bg.overlay : "transparent",
                    })}
                  >
                    <Avatar name={c.name} size="md" tone="neutral" />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium">{c.name}</Text>
                      <Text variant="bodySmall" tone="tertiary">
                        {c.handle}
                      </Text>
                    </View>
                    <Badge label="Moneto" tone="brand" size="sm" />
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.duration(200)}>
              <Card variant="outlined" padded radius="md">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Avatar name={selected.name} size="md" tone="brand" />
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{selected.name}</Text>
                    <Text variant="bodySmall" tone="tertiary">
                      {selected.handle} · Moneto user
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      haptics.tap();
                      setSelected(null);
                    }}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={20} color={colors.text.tertiary} />
                  </Pressable>
                </View>
              </Card>

              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Agregar nota (opcional)"
                placeholderTextColor={colors.text.tertiary}
                style={{
                  marginTop: 10,
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: colors.border.subtle,
                  fontFamily: fonts.sansRegular,
                  fontSize: 14,
                  color: colors.text.primary,
                }}
              />
            </Animated.View>
          )}
        </View>
      ) : (
        <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 20 }}>
          <Text variant="label" tone="secondary" style={{ marginBottom: 8 }}>
            Cuenta destino
          </Text>
          <Card variant="outlined" padded radius="md">
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.bg.overlay,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="business" size={18} color={colors.text.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyMedium">Bancolombia</Text>
                <Text variant="bodySmall" tone="tertiary">
                  Cuenta Ahorros · •••• 0284
                </Text>
              </View>
              <Badge label="~10 min" tone="neutral" size="sm" />
            </View>
          </Card>
          <Text variant="bodySmall" tone="tertiary" style={{ marginTop: 8, lineHeight: 18 }}>
            Conversión a COP al spot Jupiter · Fee 0.75% · Via Bold Colombia
          </Text>
        </Animated.View>
      )}

      {/* Privacy banner */}
      <Animated.View
        entering={FadeIn.duration(400).delay(80)}
        style={{ marginTop: "auto", marginBottom: 14 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            justifyContent: "center",
          }}
        >
          <Ionicons name="lock-closed" size={12} color={colors.value} />
          <Text variant="bodySmall" tone="value">
            {mode === "cashout"
              ? "El monto queda privado en chain"
              : "Transferencia P2P privada · gratis"}
          </Text>
        </View>
      </Animated.View>

      <Button
        label={mode === "cashout" ? "Retirar" : "Enviar"}
        variant="primary"
        size="lg"
        fullWidth
        disabled={!canSend}
        onPress={handleSend}
        rightIcon={
          <Ionicons name="arrow-forward" size={18} color={colors.text.inverse} />
        }
      />
    </Screen>
  );
}

function ModePill({
  active,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: active
          ? colors.bg.elevated
          : "transparent",
        borderWidth: 1,
        borderColor: active ? colors.border.default : colors.border.subtle,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Ionicons
        name={icon}
        size={15}
        color={active ? colors.text.primary : colors.text.tertiary}
      />
      <Text
        variant="bodySmall"
        tone={active ? "primary" : "tertiary"}
        style={{ fontWeight: "500" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

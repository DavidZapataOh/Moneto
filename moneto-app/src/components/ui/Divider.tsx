import { View } from "react-native";
import { useTheme } from "@hooks/useTheme";

interface DividerProps {
  subtle?: boolean;
  vertical?: boolean;
  style?: any;
}

export function Divider({ subtle = true, vertical = false, style }: DividerProps) {
  const { colors } = useTheme();
  const color = subtle ? colors.border.subtle : colors.border.default;

  if (vertical) {
    return <View style={[{ width: 1, backgroundColor: color, alignSelf: "stretch" }, style]} />;
  }

  return <View style={[{ height: 1, backgroundColor: color }, style]} />;
}

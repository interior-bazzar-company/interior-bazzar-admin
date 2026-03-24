import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { MdFullscreen } from "react-icons/md";
import { useModal } from "../../../../context/ModalContext";

interface UserGrowthData {
  date: string;
  users: number;
}

interface DistributionChartProps {
  data: UserGrowthData[];
  isExpanded?: boolean;
}

const DistributionChart: React.FC<DistributionChartProps> = ({ data, isExpanded }) => {
  const { showModal } = useModal();

  const handleEnlarge = () => {
    showModal(<DistributionChart data={data} isExpanded />);
  };

  return (
    <div
      style={{
        background: "#fff",
        padding: "20px",
        borderRadius: "12px",
        border: isExpanded ? "none" : "1px solid #e5e7eb",
        height: isExpanded ? "80vh" : "100%",
        display: "flex",
        flexDirection: "column",
        width: isExpanded ? "80vw" : "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h3
          style={{
            fontSize: "16px",
            fontWeight: "600",
            color: "#111827",
            margin: 0,
          }}
        >
          User Distribution
        </h3>
        {!isExpanded && (
          <button 
            onClick={handleEnlarge}
            style={{ 
              background: "none", 
              border: "none", 
              cursor: "pointer", 
              color: "#6b7280",
              display: "flex",
              alignItems: "center"
            }}
            title="Enlarge"
          >
            <MdFullscreen size={20} />
          </button>
        )}
      </div>
      <div style={{ flex: 1, minHeight: "200px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 10 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "none",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
            />
            <Bar dataKey="users" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DistributionChart;

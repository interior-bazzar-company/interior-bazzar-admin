import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { MdFullscreen } from "react-icons/md";
import { useModal } from "../../../../context/ModalContext";

interface LeadAnalyticsChartProps {
  data: any[];
  isExpanded?: boolean;
}

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

const LeadAnalyticsChart: React.FC<LeadAnalyticsChartProps> = ({ data, isExpanded }) => {
  const { showModal } = useModal();
  
  // Flatten data to include nested metrics (tags, stages, leadStatuses, statuses)
  const flattenedData = useMemo(() => {
    if (!data) return [];
    return data.map(item => {
      const flattened: any = { ...item };
      // Flatten specific nested objects mentioned in the plan
      ["tags", "stages", "leadStatuses", "statuses"].forEach(key => {
        if (item[key] && typeof item[key] === 'object') {
          Object.entries(item[key]).forEach(([subKey, value]) => {
            flattened[`${key}_${subKey}`] = value;
          });
        }
      });
      return flattened;
    });
  }, [data]);

  // Available keys for selection - dynamically extracted from all flattened data points
  const possibleKeys = useMemo(() => {
    if (flattenedData.length === 0) return ["totalLeads", "newLeads", "assignedLeads"];
    
    const keys = new Set<string>();
    flattenedData.forEach(item => {
      Object.keys(item).forEach(k => {
        if (typeof item[k] === 'number' && k !== 'id' && k !== 'date') {
          keys.add(k);
        }
      });
    });

    return Array.from(keys).sort((a, b) => {
        // Keep primary metrics at the top
        const primary = ["totalLeads", "newLeads", "assignedLeads"];
        if (primary.includes(a) && !primary.includes(b)) return -1;
        if (!primary.includes(a) && primary.includes(b)) return 1;
        return a.localeCompare(b);
    });
  }, [flattenedData]);

  const [selectedKeys, setSelectedKeys] = useState<string[]>(() => {
    return possibleKeys.slice(0, 2);
  });

  const handleEnlarge = () => {
    showModal(<LeadAnalyticsChart data={data} isExpanded />);
  };

  const toggleKey = (key: string) => {
    setSelectedKeys(prev => {
      if (prev.includes(key)) {
        return prev.filter(k => k !== key);
      }
      // Limit to 3 for clarity as per user request
      if (prev.length >= 3) {
        return [...prev.slice(1), key];
      }
      return [...prev, key];
    });
  };

  const formatKey = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/\s+/g, ' ')
      .trim();
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <h3
          style={{
            fontSize: "16px",
            fontWeight: "600",
            color: "#111827",
            margin: 0,
          }}
        >
          Lead Analytics
        </h3>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
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
      </div>

      {/* Series Selector - Grid for "Big Data" */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
        gap: "8px", 
        marginBottom: "20px",
        maxHeight: isExpanded ? "150px" : "80px",
        overflowY: "auto",
        padding: "8px",
        background: "#f9fafb",
        borderRadius: "8px",
        border: "1px solid #f3f4f6"
      }}>
        {possibleKeys.map((key, i) => (
          <label key={key} style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "11px", color: "#4b5563" }}>
            <input 
              type="checkbox" 
              checked={selectedKeys.includes(key)} 
              onChange={() => toggleKey(key)}
              style={{ accentColor: COLORS[i % COLORS.length] }}
            />
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={formatKey(key)}>
                {formatKey(key)}
            </span>
          </label>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
         {selectedKeys.length >= 3 && (
            <span style={{ fontSize: "10px", color: "#f59e0b", fontStyle: "italic" }}>
                Active: {selectedKeys.map(k => formatKey(k)).join(", ")} (Max 3)
            </span>
         )}
      </div>

      <div style={{ flex: 1, minHeight: "200px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={flattenedData}>
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
            <Legend verticalAlign="top" height={36}/>
            {selectedKeys.map((key) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={COLORS[possibleKeys.indexOf(key) % COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                name={formatKey(key)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default LeadAnalyticsChart;

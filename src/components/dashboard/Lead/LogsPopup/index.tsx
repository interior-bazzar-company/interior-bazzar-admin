import React from "react";
import styles from "./LogsPopup.module.css";

interface LogEntry {
  created?: string;
  tag?: string;
  desc?: string;
  by?: string;
  message?: string;
}

interface LogsPopupProps {
  logs: LogEntry[];
  leadId: number | string;
  title?: string;
  type?: "system" | "client";
}

const LogsPopup: React.FC<LogsPopupProps> = ({ logs, title, type = "system" }) => {

  return (
    <div className={styles.popupContent}>
      <div className={styles.popupHeader}>
        <h2 className={styles.popupTitle}>
          <strong>{title || (type === "system" ? "Logs?" : "Client Logs?")}</strong> 
          {type === "system" ? " find all the system updates here" : " find all client interactions here"}
        </h2>
      </div>
      
      <table className={styles.logsTable}>
        <thead>
          {type === "system" ? (
            <tr>
              <th>Created</th>
              <th>Tag</th>
              <th>Desc</th>
            </tr>
          ) : (
            <tr>
              <th style={{ width: '150px' }}>By</th>
              <th>Message</th>
            </tr>
          )}
        </thead>
        <tbody>
          {logs.length > 0 ? (
            logs.map((log, idx) => (
              <tr key={idx}>
                {type === "system" ? (
                  <>
                    <td>{log.created || "--"}</td>
                    <td>{log.tag || "--"}</td>
                    <td>{log.desc || "--"}</td>
                  </>
                ) : (
                  <>
                    <td style={{ textTransform: 'capitalize' }}>{log.by || "--"}</td>
                    <td>{log.message || "--"}</td>
                  </>
                )}
              </tr>
            ))
          ) : (
            // Empty rows for design padding
            Array.from({ length: 5 }).map((_, idx) => (
              <tr key={`empty-${idx}`}>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                {type === "system" && <td>&nbsp;</td>}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default LogsPopup;

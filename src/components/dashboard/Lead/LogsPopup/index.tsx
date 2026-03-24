import React from "react";
import styles from "./LogsPopup.module.css";

interface LogEntry {
  created: string;
  tag: string;
  desc: string;
}

interface LogsPopupProps {
  logs: LogEntry[];
  leadId: number | string;
}

const LogsPopup: React.FC<LogsPopupProps> = ({ logs }) => {

  return (
    <div className={styles.popupContent}>
      <div className={styles.popupHeader}>
        <h2 className={styles.popupTitle}>
          <strong>Logs?</strong> find all the clients updates here
        </h2>
      </div>
      
      <table className={styles.logsTable}>
        <thead>
          <tr>
            <th>Created</th>
            <th>Tag</th>
            <th>Desc</th>
          </tr>
        </thead>
        <tbody>
          {logs.length > 0 ? (
            logs.map((log, idx) => (
              <tr key={idx}>
                <td>{log.created}</td>
                <td>{log.tag}</td>
                <td>{log.desc}</td>
              </tr>
            ))
          ) : (
            // Empty rows for design padding
            Array.from({ length: 5 }).map((_, idx) => (
              <tr key={`empty-${idx}`}>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            ))
          )}
          {/* Pad to look like design if less logs */}
          {logs.length > 0 && logs.length < 5 && 
            Array.from({ length: 5 - logs.length }).map((_, idx) => (
              <tr key={`pad-${idx}`}>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  );
};

export default LogsPopup;

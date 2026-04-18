import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { MdChevronRight } from "react-icons/md";
import styles from "./SidebarLink.module.css";
import type { Sidebarlink } from "../../../../types/global";

const SidebarLink = (
    { item, style = { radius: false, active: false }, isOpen, }:
        { item: Sidebarlink, style?: { radius: boolean, active?: boolean }, isOpen?: boolean }) => {
    const location = useLocation();
    const hasSubLinks = item.subLinks && item.subLinks.length > 0;
    
    // Check if any sublink is active
    const isSubLinkActive = hasSubLinks && item.subLinks.some(sub => 
        location.pathname + location.search === sub.url
    );

    const [isExpanded, setIsExpanded] = useState(isSubLinkActive);

    useEffect(() => {
        if (isSubLinkActive) setIsExpanded(true);
    }, [isSubLinkActive]);

    let classNames = style.radius && styles.radius;
    classNames = classNames + " " + (!isOpen && styles.justify);
    classNames = classNames + " " + (isOpen && styles.padding);

    const handleToggle = (e: React.MouseEvent) => {
        if (hasSubLinks && isOpen) {
            e.preventDefault();
            setIsExpanded(!isExpanded);
        }
    };

    return (
        <div className={styles.linkWrapper}>
            <NavLink
                to={item.url || ""}
                className={({ isActive }) => `${styles.navItem} ${classNames} ${(isActive && !hasSubLinks) || style.active || isSubLinkActive ? styles.active : ""}`}
                onClick={handleToggle}
            >
                <span className={styles.iconSpan}>
                    {item?.icon && <item.icon />}
                </span>
                {isOpen &&
                    <span className={styles.label}>
                        {item.label}
                    </span>}
                {isOpen && hasSubLinks && (
                    <MdChevronRight 
                        className={`${styles.chevron} ${isExpanded ? styles.rotate : ""}`} 
                    />
                )}
            </NavLink>
            
            {isOpen && hasSubLinks && isExpanded && (
                <div className={styles.subLinksContainer}>
                    {item.subLinks.map((sub, index) => (
                        <NavLink
                            key={index}
                            to={sub.url}
                            className={() => 
                                `${styles.subLink} ${location.pathname + location.search === sub.url ? styles.subActive : ""}`
                            }
                        >
                            {sub.label}
                        </NavLink>
                    ))}
                </div>
            )}
        </div>
    );
}

export default SidebarLink;
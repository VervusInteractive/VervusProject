import { useState } from "react";
import { dashboardSections } from "../data/dashboardSections";

const manageGamesSectionIds = ["game", "mode-config"];
const manageRoomsSectionIds = ["live-rooms", "room-history"];
const manageProductsSectionIds = ["products"];

const navigationGroups = [
  {
    id: "manage-games",
    label: "Manage Games",
    menuId: "manage-games-menu",
    sectionIds: manageGamesSectionIds,
    sections: dashboardSections.filter((section) => manageGamesSectionIds.includes(section.id))
  },
  {
    id: "manage-rooms",
    label: "Manage Rooms",
    menuId: "manage-rooms-menu",
    sectionIds: manageRoomsSectionIds,
    sections: dashboardSections.filter((section) => manageRoomsSectionIds.includes(section.id))
  },
  {
    id: "manage-products",
    label: "Manage Products",
    menuId: "manage-products-menu",
    sectionIds: manageProductsSectionIds,
    sections: dashboardSections.filter((section) => manageProductsSectionIds.includes(section.id))
  }
];

const navigationItems = [
  { type: "section", section: dashboardSections.find((section) => section.id === "overview") },
  ...navigationGroups
    .filter((group) => group.sections.length > 0)
    .map((group) => ({ type: "group", group }))
].filter((item) => item.section || item.group);

function SectionNavigation({ activeSectionId, onSectionChange }) {
  const [openNavigationGroups, setOpenNavigationGroups] = useState(() =>
    Object.fromEntries(
      navigationGroups.map((group) => [group.id, group.sectionIds.includes(activeSectionId)])
    )
  );

  function handleNavigationGroupClick(group) {
    const shouldOpen = !openNavigationGroups[group.id];

    setOpenNavigationGroups((currentGroups) => ({
      ...currentGroups,
      [group.id]: shouldOpen
    }));

    if (shouldOpen && !group.sectionIds.includes(activeSectionId) && group.sections[0]) {
      onSectionChange(group.sections[0].id);
    }
  }

  function handleSectionChange(sectionId) {
    onSectionChange(sectionId);
    setOpenNavigationGroups(
      Object.fromEntries(navigationGroups.map((group) => [group.id, group.sectionIds.includes(sectionId)]))
    );
  }

  return (
    <aside className="dashboard-sidebar" aria-label="Admin dashboard sections">
      <div className="sidebar-brand">
        <span className="brand-mark">V</span>
        <div>
          <strong>Vervus</strong>
          <small>Admin panel</small>
        </div>
      </div>

      <nav className="section-nav">
        {navigationItems.map((item) => {
          if (item.type === "group") {
            const isGroupOpen = openNavigationGroups[item.group.id];
            const isGroupActive = item.group.sectionIds.includes(activeSectionId);

            return (
              <div className="nav-menu-group" key={item.group.id}>
                <button
                  type="button"
                  className={isGroupActive ? "nav-item menu-toggle active" : "nav-item menu-toggle"}
                  aria-expanded={isGroupOpen}
                  aria-controls={item.group.menuId}
                  onClick={() => handleNavigationGroupClick(item.group)}
                >
                  <span>{item.group.label}</span>
                  <span aria-hidden="true">{isGroupOpen ? "-" : "+"}</span>
                </button>

                {isGroupOpen && (
                  <div className="submenu-nav" id={item.group.menuId}>
                    {item.group.sections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        className={section.id === activeSectionId ? "submenu-item active" : "submenu-item"}
                        onClick={() => handleSectionChange(section.id)}
                      >
                        {section.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <button
              key={item.section.id}
              type="button"
              className={item.section.id === activeSectionId ? "nav-item active" : "nav-item"}
              onClick={() => handleSectionChange(item.section.id)}
            >
              {item.section.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export { SectionNavigation };

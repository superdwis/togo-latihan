"use client";

import { useEffect, useMemo, useState } from "react";
import { products } from "../../lib/catalog-products";
import styles from "./page.module.css";

const categories = ["Semua", ...new Set(products.map((product) => product.category))];

function formatPrice(price) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function CatalogPage() {
  const [category, setCategory] = useState("Semua");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutOrder, setCheckoutOrder] = useState(null);
  const [showCheckoutOrder, setShowCheckoutOrder] = useState(false);

  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
    return products.filter((product) => {
      const matchesCategory = category === "Semua" || product.category === category;
      const matchesQuery =
        !normalizedQuery ||
        `${product.name} ${product.category} ${product.description}`
          .toLocaleLowerCase("id-ID")
          .includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  const cartItems = products.filter((product) => cart[product.id] > 0);
  const cartCount = Object.values(cart).reduce((total, quantity) => total + quantity, 0);
  const cartTotal = cartItems.reduce(
    (total, product) => total + product.price * cart[product.id],
    0,
  );

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!checkoutOrder || checkoutOrder.status !== "pending") return undefined;
    let active = true;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/checkout/${checkoutOrder.id}`, {
          cache: "no-store",
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Status pembayaran gagal diperbarui.");
        if (active) {
          setCheckoutOrder((current) =>
            current?.id === result.order.id ? { ...current, ...result.order } : current,
          );
        }
      } catch (error) {
        if (active) setCheckoutError(error.message || "Status pembayaran gagal diperbarui.");
      }
    }, 20_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [checkoutOrder]);

  function updateQuantity(productId, amount) {
    setCart((currentCart) => {
      const nextQuantity = (currentCart[productId] || 0) + amount;
      if (nextQuantity <= 0) {
        const nextCart = { ...currentCart };
        delete nextCart[productId];
        return nextCart;
      }
      return { ...currentCart, [productId]: nextQuantity };
    });
  }

  function addToCart(product) {
    updateQuantity(product.id, 1);
    setShowCheckoutOrder(false);
    setCheckoutError("");
    setNotice(`${product.name} ditambahkan ke keranjang.`);
  }

  async function handleCheckout() {
    if (!cartItems.length || checkoutBusy) return;
    setCheckoutBusy(true);
    setCheckoutError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((product) => ({
            productId: product.id,
            quantity: cart[product.id],
          })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Pembayaran QRIS gagal dibuat.");
      setCheckoutOrder(result.order);
      setShowCheckoutOrder(true);
      setCart({});
    } catch (error) {
      setCheckoutError(error.message || "Pembayaran QRIS gagal dibuat. Coba lagi.");
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <main className={styles.store}>
      <header className={styles.header}>
        <a className={styles.brand} href="/katalog" aria-label="Toko Rona, katalog">
          <span className={styles.brandMark}>r.</span>
          <span>rona<span className={styles.brandDot}>.</span></span>
        </a>
        <nav className={styles.headerNav} aria-label="Navigasi toko">
          <a className={styles.navLink} href="#produk">Produk</a>
          <a className={styles.navLink} href="#tentang">Tentang</a>
        </nav>
        <button
          className={styles.cartButton}
          type="button"
          onClick={() => setCartOpen(true)}
          aria-label={`Buka keranjang, ${cartCount} produk`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 2-1.6L21 8H6" />
            <circle cx="10" cy="20" r="1" />
            <circle cx="18" cy="20" r="1" />
          </svg>
          <span>Keranjang</span>
          <span className={styles.cartCount}>{cartCount}</span>
        </button>
      </header>

      <section className={styles.hero} id="tentang">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span /> PILIHAN KECIL, RASA BESAR</p>
          <h1>Temukan yang bikin harimu <em>lebih nyaman.</em></h1>
          <p className={styles.heroDescription}>
            Produk pilihan untuk menemani rutinitasmu, dibuat dengan perhatian pada
            kualitas dan detail.
          </p>
          <a className={styles.heroLink} href="#produk">
            Jelajahi produk <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div className={styles.heroArt} aria-label="Ilustrasi produk pilihan" role="img">
          <span className={styles.artSun} />
          <span className={`${styles.artProduct} ${styles.artCup}`}>☕</span>
          <span className={`${styles.artProduct} ${styles.artPlant}`}>🪴</span>
          <span className={`${styles.artProduct} ${styles.artCandle}`}>🕯️</span>
          <span className={styles.artNote}>pilihan minggu ini <span>✳</span></span>
        </div>
        <div className={styles.heroFoot}>
          <span>Dikurasi dengan sepenuh hati</span>
          <span>01 — 06</span>
        </div>
      </section>

      <section className={styles.catalog} id="produk">
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>KATALOG KAMI</p>
            <h2>Temukan favoritmu<span>.</span></h2>
          </div>
          <p className={styles.productCount}>{visibleProducts.length} produk pilihan</p>
        </div>

        <div className={styles.catalogTools}>
          <div className={styles.categories} aria-label="Filter kategori">
            {categories.map((item) => (
              <button
                className={`${styles.categoryButton}${category === item ? ` ${styles.categoryActive}` : ""}`}
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                aria-pressed={category === item}
              >
                {item}
              </button>
            ))}
          </div>
          <label className={styles.searchBox}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.3 4.3" />
            </svg>
            <span className={styles.visuallyHidden}>Cari produk</span>
            <input
              type="search"
              placeholder="Cari produk..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        {visibleProducts.length ? (
          <div className={styles.productGrid}>
            {visibleProducts.map((product, index) => (
              <article className={styles.productCard} key={product.id}>
                <div className={`${styles.productImage} ${styles[product.color]}`}>
                  <span className={styles.productIndex}>0{index + 1}</span>
                  {product.badge && <span className={styles.productBadge}>{product.badge}</span>}
                  <span className={styles.productEmoji} aria-hidden="true">{product.icon}</span>
                  <span className={styles.imageDecoration} aria-hidden="true" />
                </div>
                <div className={styles.productDetails}>
                  <div className={styles.productMeta}>
                    <span>{product.category}</span>
                    <span className={styles.rating}>✳ <span>4.9</span></span>
                  </div>
                  <h3>{product.name}</h3>
                  <p className={styles.productDescription}>{product.description}</p>
                  <div className={styles.productBottom}>
                    <div className={styles.priceBlock}>
                      <strong>{formatPrice(product.price)}</strong>
                      {product.compareAt && <del>{formatPrice(product.compareAt)}</del>}
                    </div>
                    <button
                      className={styles.addButton}
                      type="button"
                      onClick={() => addToCart(product)}
                      aria-label={`Tambah ${product.name} ke keranjang`}
                    >
                      <span aria-hidden="true">+</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span aria-hidden="true">⌕</span>
            <h3>Produk belum ditemukan</h3>
            <p>Coba kata kunci lain atau pilih kategori yang berbeda.</p>
            <button type="button" onClick={() => { setQuery(""); setCategory("Semua"); }}>
              Tampilkan semua produk
            </button>
          </div>
        )}
      </section>

      <footer className={styles.footer}>
        <a className={styles.brand} href="/katalog">
          <span className={styles.brandMark}>r.</span>
          <span>rona<span className={styles.brandDot}>.</span></span>
        </a>
        <p>Temukan hal-hal baik untuk keseharianmu.</p>
        <span className={styles.footerCopyright}>© 2026 Toko Rona</span>
      </footer>

      {notice && <div className={styles.toast} role="status">{notice}</div>}

      {cartOpen && (
        <div className={styles.drawerBackdrop} onClick={() => setCartOpen(false)}>
          <aside
            className={styles.cartDrawer}
            aria-label="Keranjang belanja"
            aria-modal="true"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.drawerHeader}>
              <div>
                <p className={styles.eyebrow}>BELANJAANMU</p>
                <h2>{showCheckoutOrder ? "Pembayaran" : "Keranjang"}<span>.</span></h2>
              </div>
              <button
                className={styles.closeButton}
                type="button"
                aria-label="Tutup keranjang"
                onClick={() => { setCartOpen(false); setShowCheckoutOrder(false); }}
              >
                ×
              </button>
            </div>
            {showCheckoutOrder && checkoutOrder ? (
              <div className={styles.paymentPanel}>
                <p className={styles.paymentIntro}>
                  {checkoutOrder.status === "success"
                    ? "Pembayaran berhasil diterima."
                    : checkoutOrder.status === "expired"
                      ? "QRIS sudah kedaluwarsa. Silakan buat pembayaran baru."
                      : checkoutOrder.status === "failed"
                        ? "Pembayaran gagal. Silakan coba kembali."
                        : "Pindai QRIS berikut untuk menyelesaikan pembayaran."}
                </p>
                {checkoutOrder.isTest && (
                  <p className={styles.testModeNotice} role="status">
                    Mode TEST: transaksi sandbox, tidak menggunakan uang sungguhan.
                  </p>
                )}
                {checkoutOrder.status === "pending" && (
                  <>
                    {checkoutOrder.qrImage ? (
                      <img className={styles.paymentQr} src={checkoutOrder.qrImage} alt="QRIS pembayaran" />
                    ) : checkoutOrder.paymentUrl ? (
                      <a className={styles.paymentLink} href={checkoutOrder.paymentUrl} target="_blank" rel="noreferrer">
                        Buka halaman pembayaran
                      </a>
                    ) : (
                      <p className={styles.checkoutError}>QR pembayaran tidak tersedia.</p>
                    )}
                    <p className={styles.paymentAmount}>Total pembayaran</p>
                    <strong className={styles.paymentTotal}>{formatPrice(checkoutOrder.totalAmount)}</strong>
                    <p className={styles.paymentReference}>ID transaksi: {checkoutOrder.transactionId}</p>
                    {checkoutOrder.expiredAt && (
                      <p className={styles.paymentExpiry}>
                        Batas pembayaran: {new Intl.DateTimeFormat("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(checkoutOrder.expiredAt))}
                      </p>
                    )}
                    <p className={styles.paymentWaiting}>Status diperbarui otomatis setelah pembayaran terkonfirmasi.</p>
                  </>
                )}
                <button
                  className={styles.backToCartButton}
                  type="button"
                  onClick={() => setShowCheckoutOrder(false)}
                >
                  Kembali ke keranjang
                </button>
              </div>
            ) : cartItems.length ? (
              <>
                <div className={styles.cartItems}>
                  {cartItems.map((product) => (
                    <div className={styles.cartItem} key={product.id}>
                      <div className={`${styles.cartItemImage} ${styles[product.color]}`} aria-hidden="true">
                        {product.icon}
                      </div>
                      <div className={styles.cartItemInfo}>
                        <h3>{product.name}</h3>
                        <p>{formatPrice(product.price)}</p>
                        <div className={styles.quantityControl}>
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.id, -1)}
                            aria-label={`Kurangi jumlah ${product.name}`}
                          >−</button>
                          <span>{cart[product.id]}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(product.id, 1)}
                            aria-label={`Tambah jumlah ${product.name}`}
                          >+</button>
                        </div>
                      </div>
                      <strong>{formatPrice(product.price * cart[product.id])}</strong>
                    </div>
                  ))}
                </div>
                <div className={styles.cartSummary}>
                  <div><span>Subtotal</span><strong>{formatPrice(cartTotal)}</strong></div>
                  <p>Biaya admin QRIS mengikuti informasi yang diberikan saat pembayaran.</p>
                  {checkoutError && <p className={styles.checkoutError} role="alert">{checkoutError}</p>}
                  <button
                    className={styles.checkoutButton}
                    type="button"
                    onClick={handleCheckout}
                    disabled={checkoutBusy || cartTotal < 1000 || cartTotal > 5000000}
                  >
                    {checkoutBusy ? "Menyiapkan QRIS..." : "Bayar dengan QRIS"}
                  </button>
                  <span className={styles.checkoutHint}>
                    {cartTotal > 5000000
                      ? "Maksimum transaksi QRIS Rp 5.000.000."
                      : "Pembayaran diproses dengan aman melalui BuatQris."}
                  </span>
                </div>
              </>
            ) : (
              <div className={styles.cartEmpty}>
                <span aria-hidden="true">＋</span>
                <h3>Keranjangmu masih kosong</h3>
                <p>Tambahkan produk pilihanmu dan semuanya akan muncul di sini.</p>
                <button type="button" onClick={() => setCartOpen(false)}>Lihat produk</button>
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

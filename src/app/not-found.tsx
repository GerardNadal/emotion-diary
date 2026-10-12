import Link from "next/link";
import { Brand } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-lg flex-col items-start gap-6 px-7 py-16">
      <Brand />
      <h1 className="text-2xl font-semibold">
        Este espacio no está disponible
      </h1>
      <p className="text-sm text-muted-foreground">
        La página no existe o no está disponible para tu cuenta.
      </p>
      <Link className={buttonVariants({ variant: "outline" })} href="/">
        Volver a mi espacio
      </Link>
    </section>
  );
}

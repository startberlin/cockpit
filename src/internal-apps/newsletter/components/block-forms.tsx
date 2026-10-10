"use client";

import { useEffect, useRef } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Block, BlockOfKind } from "../lib/blocks";
import {
  FieldRow,
  LabeledInput,
  LabeledTextarea,
  RepeatableList,
} from "./block-fields";
import { ImageField } from "./image-field";
import { RichTextEditor } from "./rich-text-editor";

/**
 * One form per block kind. Each receives its block and a patch callback; the
 * composer owns the array and the autosave, so nothing here touches the server.
 */

type Patch<K extends Block["kind"]> = (patch: Partial<BlockOfKind<K>>) => void;

function HeroForm({
  block,
  patch,
}: {
  block: BlockOfKind<"hero">;
  patch: Patch<"hero">;
}) {
  return (
    <>
      <ImageField
        label="Hero image"
        value={block.image}
        onChange={(image) => patch({ image })}
      />
      <LabeledInput
        label="Eyebrow"
        value={block.eyebrow}
        placeholder="Issue 01 · October 2026"
        onChange={(eyebrow) => patch({ eyebrow })}
      />
      <LabeledInput
        label="Headline"
        value={block.headline}
        placeholder="What this issue is about"
        onChange={(headline) => patch({ headline })}
      />
      <LabeledTextarea
        label="Subheadline"
        value={block.subheadline}
        rows={2}
        placeholder="One sentence that earns the next thirty seconds."
        onChange={(subheadline) => patch({ subheadline })}
      />
    </>
  );
}

function HeadingForm({
  block,
  patch,
}: {
  block: BlockOfKind<"heading">;
  patch: Patch<"heading">;
}) {
  return (
    <>
      <LabeledInput
        label="Heading"
        value={block.text}
        placeholder="Berlin startup news"
        onChange={(text) => patch({ text })}
      />
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={String(block.level)}
        onValueChange={(value) => {
          if (value) patch({ level: value === "2" ? 2 : 3 });
        }}
        className="self-start"
      >
        <ToggleGroupItem value="2">Section</ToggleGroupItem>
        <ToggleGroupItem value="3">Sub-heading</ToggleGroupItem>
      </ToggleGroup>
    </>
  );
}

function TextForm({
  block,
  patch,
  editable = true,
}: {
  block: BlockOfKind<"text">;
  patch: Patch<"text">;
  editable?: boolean;
}) {
  return (
    <RichTextEditor
      editable={editable}
      value={block.body}
      onChange={(body) => patch({ body })}
    />
  );
}

function ImageForm({
  block,
  patch,
}: {
  block: BlockOfKind<"image">;
  patch: Patch<"image">;
}) {
  return (
    <>
      <ImageField
        label="Image"
        value={block.image}
        onChange={(image) => patch({ image })}
      />
      <FieldRow>
        <LabeledInput
          label="Caption"
          value={block.caption}
          onChange={(caption) => patch({ caption })}
        />
        <LabeledInput
          label="Links to"
          value={block.href}
          placeholder="https://"
          onChange={(href) => patch({ href })}
        />
      </FieldRow>
    </>
  );
}

function ButtonForm({
  block,
  patch,
}: {
  block: BlockOfKind<"button">;
  patch: Patch<"button">;
}) {
  return (
    <>
      <FieldRow>
        <LabeledInput
          label="Label"
          value={block.label}
          placeholder="Come to the next Founders Night"
          onChange={(label) => patch({ label })}
        />
        <LabeledInput
          label="Links to"
          value={block.href}
          placeholder="https://"
          onChange={(href) => patch({ href })}
        />
      </FieldRow>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={block.align}
        onValueChange={(value) => {
          if (value === "left" || value === "center") patch({ align: value });
        }}
        className="self-start"
      >
        <ToggleGroupItem value="left">Left</ToggleGroupItem>
        <ToggleGroupItem value="center">Centred</ToggleGroupItem>
      </ToggleGroup>
    </>
  );
}

function LinkListForm({
  block,
  patch,
}: {
  block: BlockOfKind<"linkList">;
  patch: Patch<"linkList">;
}) {
  return (
    <>
      <LabeledInput
        label="Section title"
        value={block.title}
        placeholder="Berlin startup news"
        onChange={(title) => patch({ title })}
      />
      <RepeatableList
        items={block.items}
        onChange={(items) => patch({ items })}
        createItem={() => ({ title: "", url: "", source: "", blurb: "" })}
        addLabel="Add a link"
        renderItem={(item, update) => (
          <>
            <LabeledInput
              label="Headline"
              value={item.title}
              onChange={(title) => update({ title })}
            />
            <FieldRow>
              <LabeledInput
                label="URL"
                value={item.url}
                placeholder="https://"
                onChange={(url) => update({ url })}
              />
              <LabeledInput
                label="Category"
                value={item.source}
                placeholder="Funding"
                onChange={(source) => update({ source })}
              />
            </FieldRow>
            <LabeledInput
              label="One line"
              value={item.blurb}
              onChange={(blurb) => update({ blurb })}
            />
          </>
        )}
      />
    </>
  );
}

function StartupSpotlightForm({
  block,
  patch,
}: {
  block: BlockOfKind<"startupSpotlight">;
  patch: Patch<"startupSpotlight">;
}) {
  return (
    <>
      <LabeledInput
        label="Section title"
        value={block.title}
        placeholder="Three startups we like"
        onChange={(title) => patch({ title })}
      />
      <RepeatableList
        items={block.items}
        max={5}
        onChange={(items) => patch({ items })}
        createItem={(): BlockOfKind<"startupSpotlight">["items"][number] => ({
          name: "",
          oneLiner: "",
          url: "",
          tag: "",
        })}
        addLabel="Add a startup"
        renderItem={(item, update) => (
          <>
            <FieldRow>
              <LabeledInput
                label="Name"
                value={item.name}
                onChange={(name) => update({ name })}
              />
              <LabeledInput
                label="Tag"
                value={item.tag}
                placeholder="Fintech"
                onChange={(tag) => update({ tag })}
              />
            </FieldRow>
            <LabeledInput
              label="One line"
              value={item.oneLiner}
              placeholder="What they do, in one sentence."
              onChange={(oneLiner) => update({ oneLiner })}
            />
            <LabeledInput
              label="URL"
              value={item.url}
              placeholder="https://"
              onChange={(url) => update({ url })}
            />
            <ImageField
              label="Logo"
              value={item.logo}
              onChange={(logo) => update({ logo })}
            />
          </>
        )}
      />
    </>
  );
}

function EventRecapForm({
  block,
  patch,
  editable = true,
}: {
  block: BlockOfKind<"eventRecap">;
  patch: Patch<"eventRecap">;
  editable?: boolean;
}) {
  return (
    <>
      <ImageField
        label="Photo"
        value={block.image}
        onChange={(image) => patch({ image })}
      />
      <FieldRow>
        <LabeledInput
          label="Title"
          value={block.title}
          placeholder="What we learned at Founders Night #12"
          onChange={(title) => patch({ title })}
        />
        <LabeledInput
          label="Date label"
          value={block.dateLabel}
          placeholder="Event recap · 14 September"
          onChange={(dateLabel) => patch({ dateLabel })}
        />
      </FieldRow>
      <RichTextEditor
        editable={editable}
        value={block.body}
        onChange={(body) => patch({ body })}
      />
      <FieldRow>
        <LabeledInput
          label="Link label"
          value={block.ctaLabel}
          placeholder="See the photos"
          onChange={(ctaLabel) => patch({ ctaLabel })}
        />
        <LabeledInput
          label="Link URL"
          value={block.ctaHref}
          placeholder="https://"
          onChange={(ctaHref) => patch({ ctaHref })}
        />
      </FieldRow>
    </>
  );
}

function InterviewForm({
  block,
  patch,
  editable = true,
}: {
  block: BlockOfKind<"interview">;
  patch: Patch<"interview">;
  editable?: boolean;
}) {
  return (
    <>
      <ImageField
        label="Portrait"
        value={block.portrait}
        onChange={(portrait) => patch({ portrait })}
      />
      <FieldRow>
        <LabeledInput
          label="Name"
          value={block.name}
          onChange={(name) => patch({ name })}
        />
        <LabeledInput
          label="Role"
          value={block.role}
          placeholder="Partner"
          onChange={(role) => patch({ role })}
        />
      </FieldRow>
      <LabeledInput
        label="Company"
        value={block.company}
        onChange={(company) => patch({ company })}
      />
      <LabeledTextarea
        label="Pull quote"
        value={block.quote}
        rows={2}
        placeholder="The one sentence worth reading the section for."
        onChange={(quote) => patch({ quote })}
      />
      <RichTextEditor
        editable={editable}
        value={block.body}
        onChange={(body) => patch({ body })}
      />
      <LabeledInput
        label="Full interview URL"
        value={block.href}
        placeholder="https://"
        onChange={(href) => patch({ href })}
      />
    </>
  );
}

function AlumniStoryForm({
  block,
  patch,
  editable = true,
}: {
  block: BlockOfKind<"alumniStory">;
  patch: Patch<"alumniStory">;
  editable?: boolean;
}) {
  return (
    <>
      <ImageField
        label="Portrait"
        value={block.portrait}
        onChange={(portrait) => patch({ portrait })}
      />
      <FieldRow>
        <LabeledInput
          label="Name"
          value={block.name}
          onChange={(name) => patch({ name })}
        />
        <LabeledInput
          label="Batch"
          value={block.batchLabel}
          placeholder="Batch 7"
          onChange={(batchLabel) => patch({ batchLabel })}
        />
      </FieldRow>
      <LabeledInput
        label="Headline"
        value={block.headline}
        onChange={(headline) => patch({ headline })}
      />
      <RichTextEditor
        editable={editable}
        value={block.body}
        onChange={(body) => patch({ body })}
      />
      <LabeledInput
        label="Story URL"
        value={block.href}
        placeholder="https://"
        onChange={(href) => patch({ href })}
      />
    </>
  );
}

function JobHighlightForm({
  block,
  patch,
}: {
  block: BlockOfKind<"jobHighlight">;
  patch: Patch<"jobHighlight">;
}) {
  return (
    <>
      <LabeledInput
        label="Section title"
        value={block.title}
        placeholder="Hiring in the network"
        onChange={(title) => patch({ title })}
      />
      <RepeatableList
        items={block.items}
        onChange={(items) => patch({ items })}
        createItem={(): BlockOfKind<"jobHighlight">["items"][number] => ({
          company: "",
          role: "",
          location: "",
          url: "",
        })}
        addLabel="Add a role"
        renderItem={(item, update) => (
          <>
            <FieldRow>
              <LabeledInput
                label="Role"
                value={item.role}
                onChange={(role) => update({ role })}
              />
              <LabeledInput
                label="Company"
                value={item.company}
                onChange={(company) => update({ company })}
              />
            </FieldRow>
            <FieldRow>
              <LabeledInput
                label="Location"
                value={item.location}
                placeholder="Berlin · Hybrid"
                onChange={(location) => update({ location })}
              />
              <LabeledInput
                label="URL"
                value={item.url}
                placeholder="https://"
                onChange={(url) => update({ url })}
              />
            </FieldRow>
            <ImageField
              label="Company logo"
              value={item.logo}
              onChange={(logo) => update({ logo })}
            />
          </>
        )}
      />
    </>
  );
}

export function BlockForm({
  block,
  onChange,
  editable = true,
}: {
  block: Block;
  onChange: (block: Block) => void;
  editable?: boolean;
}) {
  // The cast is contained here: `patch` is typed against the specific variant in
  // each form, and the discriminant is never part of a patch.
  const current = useRef({ block, onChange, editable });
  useEffect(() => {
    current.current = { block, onChange, editable };
  }, [block, onChange, editable]);
  const patch = (p: Record<string, unknown>) => {
    if (!current.current.editable) return;
    const next = { ...current.current.block, ...p } as Block;
    current.current.block = next;
    current.current.onChange(next);
  };

  switch (block.kind) {
    case "hero":
      return <HeroForm block={block} patch={patch} />;
    case "heading":
      return <HeadingForm block={block} patch={patch} />;
    case "text":
      return <TextForm block={block} patch={patch} editable={editable} />;
    case "image":
      return <ImageForm block={block} patch={patch} />;
    case "button":
      return <ButtonForm block={block} patch={patch} />;
    case "divider":
      return (
        <p className="text-sm text-muted-foreground">
          A horizontal rule. Nothing to configure.
        </p>
      );
    case "linkList":
      return <LinkListForm block={block} patch={patch} />;
    case "startupSpotlight":
      return <StartupSpotlightForm block={block} patch={patch} />;
    case "eventRecap":
      return <EventRecapForm block={block} patch={patch} editable={editable} />;
    case "interview":
      return <InterviewForm block={block} patch={patch} editable={editable} />;
    case "alumniStory":
      return (
        <AlumniStoryForm block={block} patch={patch} editable={editable} />
      );
    case "jobHighlight":
      return <JobHighlightForm block={block} patch={patch} />;
  }
}
